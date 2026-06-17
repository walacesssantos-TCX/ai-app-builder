#!/usr/bin/env python3
"""Transcribe audio using faster-whisper with GPU (CUDA) support."""

import argparse
import json
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='tiny')
    parser.add_argument('--device', default='cuda')
    parser.add_argument('--compute-type', default='float16')
    parser.add_argument('--audio-path', required=True)
    parser.add_argument('--language')
    parser.add_argument('--beam-size', type=int, default=5)
    parser.add_argument('--best-of', type=int, default=5)
    parser.add_argument('--temperature', type=float, default=0.0)
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--condition-on-previous-text', action='store_true', default=True)
    parser.add_argument('--initial-prompt')
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    try:
        print(f"[fw] Loading {args.model} on {args.device} ({args.compute_type})", file=sys.stderr)
        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    except Exception as e:
        print(f"[fw] GPU failed ({e}), fallback to CPU int8", file=sys.stderr)
        model = WhisperModel(args.model, device='cpu', compute_type='int8')

    print(f"[fw] Transcribing {args.audio_path}...", file=sys.stderr)
    start = time.time()

    kwargs = {
        'beam_size': args.beam_size,
        'best_of': args.best_of,
        'temperature': args.temperature,
        'batch_size': args.batch_size,
        'condition_on_previous_text': args.condition_on_previous_text,
    }
    if args.language:
        kwargs['language'] = args.language
    if args.initial_prompt:
        kwargs['initial_prompt'] = args.initial_prompt

    segments, info = model.transcribe(args.audio_path, **kwargs)

    text_parts = []
    for segment in segments:
        text_parts.append(segment.text.strip())

    elapsed = time.time() - start
    result = {
        'text': ' '.join(text_parts),
        'language': info.language if info else None,
        'duration_seconds': info.duration if info else None,
        'elapsed_seconds': round(elapsed, 2),
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stdout)
        sys.exit(1)
