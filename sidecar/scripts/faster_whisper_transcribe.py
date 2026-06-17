#!/usr/bin/env python3
"""
Faster Whisper Transcribe Script

This script is used to transcribe audio files using the Faster Whisper model.
It provides a command-line interface for converting speech to text.
"""

import sys
import os
from pathlib import Path
import argparse

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio files using Faster Whisper")
    parser.add_argument("input", help="Input audio file path")
    parser.add_argument("--output", help="Output text file path (optional)")
    parser.add_argument("--model", default="medium", help="Whisper model to use (tiny, base, small, medium, large)")
    parser.add_argument("--language", default="en", help="Language code (default: en)")
    parser.add_argument("--beam-size", type=int, default=5, help="Beam size for decoding")
    parser.add_argument("--vad-threshold", type=float, default=0.5, help="VAD threshold")
    parser.add_argument("--vad-min-speech-duration", type=float, default=0.25, help="Minimum speech duration")
    parser.add_argument("--vad-max-speech-duration", type=float, default=30.0, help="Maximum speech duration")
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    # Try to import faster_whisper
    try:
        import whisper
    except ImportError:
        print("Error: faster_whisper package is not installed. Please install it with: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)
    
    # Load the model
    print(f"Loading Whisper model: {args.model}")
    model = whisper.load_model(args.model)
    
    # Transcribe the audio
    print(f"Transcribing audio file: {args.input}")
    result = model.transcribe(
        args.input,
        language=args.language,
        beam_size=args.beam_size,
        vad_filter=True,
        vad_threshold=args.vad_threshold,
        vad_min_speech_duration=args.vad_min_speech_duration,
        vad_max_speech_duration=args.vad_max_speech_duration
    )
    
    # Get the transcribed text
    text = result["text"]
    
    # Print the result
    print("\nTranscription:")
    print("=" * 50)
    print(text)
    print("=" * 50)
    
    # Save to file if output path is provided
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"\nTranscription saved to: {args.output}")
    
    # Save to a default file if not specified
    else:
        output_path = Path(args.input).with_suffix(".txt")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"\nTranscription saved to: {output_path}")

if __name__ == "__main__":
    main()
