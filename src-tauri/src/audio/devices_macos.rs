//! macOS CoreAudio device enumeration via raw FFI (coreaudio-sys 0.2).
//!
//! We deliberately use `coreaudio-sys` 0.2 (low-level bindings) rather
//! than the higher-level `coreaudio-rs` 0.14 wrapper because:
//! - `coreaudio-sys` with only the `core_audio` feature compiles fast
//!   (just CoreAudio framework, no AudioUnit / AudioToolbox).
//! - We only need to enumerate devices for the pre-flight topology
//!   check; we do not open streams, configure AUHALs, or play audio
//!   here. `cpal` 0.15 (added later in ticket #03) will own the
//!   actual stream I/O.
//! - The FFI call surface is small: ~3 properties queried per device
//!   (name, transport, stream config). Easier to audit + to clippy
//!   without falling into the objc2 ref-counting land.

use std::mem;
use std::os::raw::{c_long, c_void};

use coreaudio_sys::{
    kAudioDevicePropertyIsHidden, kAudioDevicePropertyTransportType,
    kAudioHardwarePropertyDevices, kAudioObjectPropertyClass,
    kAudioObjectPropertyName, kAudioObjectSystemObject,
    kAudioDevicePropertyStreamConfiguration,
    AudioBufferList, AudioClassID, AudioObjectGetPropertyData,
    AudioObjectGetPropertyDataSize, AudioObjectID, AudioObjectPropertyAddress, UInt32,
};

use serde::Serialize;

/// One discovered audio endpoint (input or output or both).
#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    /// CoreAudio `AudioObjectID`. Stable for the lifetime of the
    /// device; changes after a hot-unplug.
    pub id: u32,
    /// User-visible device name.
    pub name: String,
    /// Transport kind label (Virtual, Built-in, USB, Aggregate, ...).
    pub transport: String,
    /// Total input channels summed across input streams.
    pub channel_count_in: u32,
    /// Total output channels summed across output streams.
    pub channel_count_out: u32,
}

const K_AUDIO_OBJECT_CLASSID_AUDIO_DEVICE: AudioClassID = fourcc(b"adev");

const fn fourcc(bytes: &[u8; 4]) -> AudioClassID {
    AudioClassID::from_be_bytes(*bytes)
}

#[inline]
fn property(
    selector: coreaudio_sys::AudioObjectPropertySelector,
    scope: coreaudio_sys::AudioObjectPropertyScope,
    element: coreaudio_sys::AudioObjectPropertyElement,
) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: selector,
        mScope: scope,
        mElement: element,
    }
}

/// Enumerate every audio device visible to the host.
pub fn enumerate_devices() -> Vec<AudioDevice> {
    let device_ids = match get_system_devices() {
        Ok(ids) => ids,
        Err(_) => return Vec::new(),
    };

    let mut out = Vec::with_capacity(device_ids.len());
    for id in device_ids {
        if is_hidden(id) {
            continue;
        }
        if get_class_id(id) != K_AUDIO_OBJECT_CLASSID_AUDIO_DEVICE {
            continue;
        }
        let name = get_device_name(id).unwrap_or_else(|| format!("device-{}", id));
        let transport = get_transport_label(id);
        let (channels_in, channels_out) = get_channel_counts(id);
        out.push(AudioDevice {
            id,
            name,
            transport,
            channel_count_in: channels_in,
            channel_count_out: channels_out,
        });
    }
    out
}

fn get_system_devices() -> Result<Vec<AudioObjectID>, i32> {
    let addr = property(
        kAudioHardwarePropertyDevices,
        coreaudio_sys::kAudioObjectPropertyScopeGlobal,
        coreaudio_sys::kAudioObjectPropertyElementMain,
    );
    let mut size: UInt32 = 0;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(
            kAudioObjectSystemObject as AudioObjectID,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
        )
    };
    if status != 0 {
        return Err(status as i32);
    }
    let count = (size as usize) / mem::size_of::<AudioObjectID>();
    let mut ids: Vec<AudioObjectID> = vec![0; count];
    let status = unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject as AudioObjectID,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            ids.as_mut_ptr() as *mut c_void,
        )
    };
    if status != 0 {
        return Err(status as i32);
    }
    Ok(ids)
}

fn is_hidden(id: AudioObjectID) -> bool {
    let addr = property(
        kAudioDevicePropertyIsHidden,
        coreaudio_sys::kAudioObjectPropertyScopeGlobal,
        coreaudio_sys::kAudioObjectPropertyElementMain,
    );
    let mut hidden: UInt32 = 0;
    let mut size = mem::size_of::<UInt32>() as UInt32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            &mut hidden as *mut _ as *mut c_void,
        )
    };
    status == 0 && hidden != 0
}

fn get_class_id(id: AudioObjectID) -> AudioClassID {
    let addr = property(
        kAudioObjectPropertyClass,
        coreaudio_sys::kAudioObjectPropertyScopeGlobal,
        coreaudio_sys::kAudioObjectPropertyElementMain,
    );
    let mut class: AudioClassID = 0;
    let mut size = mem::size_of::<AudioClassID>() as UInt32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            &mut class as *mut _ as *mut c_void,
        )
    };
    if status == 0 {
        class
    } else {
        0
    }
}

fn get_device_name(id: AudioObjectID) -> Option<String> {
    // `kAudioObjectPropertyName` is the canonical CoreAudio selector
    // that returns a retained `CFStringRef` via the outData slot of
    // AudioObjectGetPropertyData. `kAudioDevicePropertyDeviceName`
    // (added in 10.10) returns a *borrowed* CFStringRef via a
    // different mechanism that the bindings here do not cover, so
    // using it crashes CoreFoundation when the returned value is
    // misinterpreted as raw bytes. Stick to `kAudioObjectPropertyName`
    // which has stable semantics across all macOS versions.
    let addr = property(
        kAudioObjectPropertyName,
        coreaudio_sys::kAudioObjectPropertyScopeGlobal,
        coreaudio_sys::kAudioObjectPropertyElementMain,
    );
    let mut cf_str: *mut c_void = std::ptr::null_mut();
    let mut size = mem::size_of::<*mut c_void>() as UInt32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            &mut cf_str as *mut _ as *mut c_void,
        )
    };
    if status != 0 || cf_str.is_null() {
        return None;
    }
    cfstring_to_string(cf_str)
}

fn cfstring_to_string(cf_str: *const c_void) -> Option<String> {
    extern "C" {
        fn CFStringGetCString(
            the_string: *const c_void,
            buffer: *mut i8,
            buffer_size: c_long,
            encoding: u32,
        ) -> bool;
        fn CFStringGetLength(the_string: *const c_void) -> c_long;
        fn CFRelease(cf: *const c_void);
    }
    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
    unsafe {
        let len = CFStringGetLength(cf_str);
        if len <= 0 {
            return None;
        }
        let bufsize = (len as usize) * 4 + 1;
        let mut buf = vec![0i8; bufsize];
        if CFStringGetCString(
            cf_str,
            buf.as_mut_ptr(),
            bufsize as c_long,
            K_CF_STRING_ENCODING_UTF8,
        ) {
            let cstr = std::ffi::CStr::from_ptr(buf.as_ptr());
            let s = cstr.to_string_lossy().into_owned();
            CFRelease(cf_str);
            Some(s)
        } else {
            CFRelease(cf_str);
            None
        }
    }
}

fn get_transport_label(id: AudioObjectID) -> String {
    let addr = property(
        kAudioDevicePropertyTransportType,
        coreaudio_sys::kAudioObjectPropertyScopeGlobal,
        coreaudio_sys::kAudioObjectPropertyElementMain,
    );
    let mut transport: UInt32 = 0;
    let mut size = mem::size_of::<UInt32>() as UInt32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            &mut transport as *mut _ as *mut c_void,
        )
    };
    if status != 0 {
        return String::from("Unknown");
    }
    transport_label(transport).to_string()
}

fn transport_label(t: UInt32) -> String {
    // TransportType fourccs from AudioHardwareBase.h. We compare via
    // `u32::from_be_bytes` to avoid pulling in any extra fourcc crate.
    if t == u32::from_be_bytes(*b"bult") {
        return String::from("Built-in");
    }
    if t == u32::from_be_bytes(*b"usb ") {
        return String::from("USB");
    }
    if t == u32::from_be_bytes(*b"virt") {
        return String::from("Virtual");
    }
    if t == u32::from_be_bytes(*b"aggr") {
        return String::from("Aggregate");
    }
    if t == u32::from_be_bytes(*b"hdmi") {
        return String::from("HDMI");
    }
    if t == u32::from_be_bytes(*b"drim") {
        return String::from("DisplayPort");
    }
    if t == u32::from_be_bytes(*b"pcie") {
        return String::from("PCIe");
    }
    if t == u32::from_be_bytes(*b"airp") {
        return String::from("AirPlay");
    }
    if t == u32::from_be_bytes(*b"blth") {
        return String::from("Bluetooth");
    }
    String::from("Other")
}

fn get_channel_counts(id: AudioObjectID) -> (u32, u32) {
    let mut channels_in = 0u32;
    let mut channels_out = 0u32;
    for (scope, is_input) in [
        (coreaudio_sys::kAudioDevicePropertyScopeInput, true),
        (coreaudio_sys::kAudioDevicePropertyScopeOutput, false),
    ] {
        let addr = property(
            kAudioDevicePropertyStreamConfiguration,
            scope,
            coreaudio_sys::kAudioObjectPropertyElementMain,
        );
        let mut size: UInt32 = 0;
        let status =
            unsafe { AudioObjectGetPropertyDataSize(id, &addr, 0, std::ptr::null(), &mut size) };
        if status != 0 || size == 0 {
            continue;
        }
        let buflist_size = size as usize;
        let mut buf = vec![0u8; buflist_size];
        let buflist_ptr = buf.as_mut_ptr() as *mut AudioBufferList;
        let status = unsafe {
            AudioObjectGetPropertyData(
                id,
                &addr,
                0,
                std::ptr::null(),
                &mut size,
                buflist_ptr as *mut c_void,
            )
        };
        if status != 0 {
            continue;
        }
        let buflist = unsafe { &*buflist_ptr };
        let n_buffers = buflist.mNumberBuffers as usize;
        let buffers_ptr = buflist.mBuffers.as_ptr();
        let mut total: u32 = 0;
        for i in 0..n_buffers {
            let buffer = unsafe { &*buffers_ptr.add(i) };
            total = total.saturating_add(buffer.mNumberChannels);
        }
        if is_input {
            channels_in = total;
        } else {
            channels_out = total;
        }
    }
    (channels_in, channels_out)
}
