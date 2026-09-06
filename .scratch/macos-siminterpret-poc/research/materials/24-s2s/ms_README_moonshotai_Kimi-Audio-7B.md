---
license: mit
language:
- en
- zh
tags:
- audio
- audio-language-model
- speech-recognition
- audio-understanding
- text-to-speech
- audio-generation
- chat
library_name: kimi-audio
---

# Kimi-Audio

<p align="center">
    <img src="https://raw.githubusercontent.com/MoonshotAI/Kimi-Audio/master/assets/kimia_logo.png" width="400"/>
<p>

<p align="center">
<a href="https://huggingface.co/moonshotai/Kimi-Audio-7B">🤗 Kimi-Audio-7B</a> | <a href="https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct">🤗 Kimi-Audio-7B-Instruct </a> | <a href="https://raw.githubusercontent.com/MoonshotAI/Kimi-Audio/master/assets/kimia_report.pdf">📑 Paper</a>
</p>

## Introduction

We present Kimi-Audio, an open-source audio foundation model excelling in **audio understanding, generation, and conversation**. This repository hosts the model checkpoints for Kimi-Audio-7B.

Kimi-Audio is designed as a universal audio foundation model capable of handling a wide variety of audio processing tasks within a single unified framework. Key features include:

*   **Universal Capabilities:** Handles diverse tasks like speech recognition (ASR), audio question answering (AQA), audio captioning (AAC), speech emotion recognition (SER), sound event/scene classification (SEC/ASC) and end-to-end speech conversation.
*   **State-of-the-Art Performance:** Achieves SOTA results on numerous audio benchmarks (see our [Technical Report](https://raw.githubusercontent.com/MoonshotAI/Kimi-Audio/master/assets/kimia_report.pdf)).
*   **Large-Scale Pre-training:** Pre-trained on over 13 million hours of diverse audio data (speech, music, sounds) and text data.
*   **Novel Architecture:** Employs a hybrid audio input (continuous acoustic + discrete semantic tokens) and an LLM core with parallel heads for text and audio token generation.
*   **Efficient Inference:** Features a chunk-wise streaming detokenizer based on flow matching for low-latency audio generation.

For more details, please refer to our [GitHub Repository](https://github.com/MoonshotAI/Kimi-Audio) and [Technical Report](https://raw.githubusercontent.com/MoonshotAI/Kimi-Audio/master/assets/kimia_report.pdf). 

## Note

Kimi-Audio-7B is a base model without fine-tuning. So it cannot be used directly.
The base model is quite flexible, you can fine-tune it on any possible downstream tasks.

If you are looking for an out-of-the-box model, please refer to [Kimi-Audio-7B-Instruct](https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct).


## Citation

If you find Kimi-Audio useful in your research or applications, please cite our technical report:

```bibtex
@misc{kimi_audio_2024,
      title={Kimi-Audio Technical Report},
      author={Kimi Team},
      year={2024},
      eprint={arXiv:placeholder},
      archivePrefix={arXiv},
      primaryClass={cs.CL}
}
```

## License

The model is based and modified from [Qwen 2.5-7B](https://github.com/QwenLM/Qwen2.5). Code derived from Qwen2.5-7B is licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). Other parts of the code are licensed under the [MIT License](https://opensource.org/licenses/MIT).
