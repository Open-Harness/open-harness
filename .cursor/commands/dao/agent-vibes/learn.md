Turn language learning mode ON or OFF. When enabled, the assistant should speak acknowledgments and completions in BOTH your main language and target language.

Usage:
```
/agent-vibes:learn              # Turn ON
/agent-vibes:learn off          # Turn OFF
/agent-vibes:learn status       # Show current setup
```

## What to do when this command is invoked

Maintain a small, explicit state block in the conversation:

```
AgentVibes:
- mainLanguage: <string | unset>
- targetLanguage: <string | unset>
- targetVoice: <string | unset>
- learningMode: <on|off>
```

Then:
- If invoked with no args: set `learningMode: on`
- If invoked with `off`: set `learningMode: off`
- If invoked with `status`: print the full block and do not change state

## How Learning Mode Works

When learning mode is **ON**:
1. **First**: Speak in your main language
2. **Then**: Speak the SAME message translated to your target language

Example:
```
Main language (English): "I'll check that for you"
Target language (Spanish): "Lo verificaré para ti"
```

## Setup Steps

1. Set your main language:
   ```
   /agent-vibes:language english
   ```

2. Set your target language:
   ```
   /agent-vibes:target spanish
   ```

3. Set target voice (recommended):
   ```
   /agent-vibes:target-voice Antoni
   ```

4. Enable learning mode:
   ```
   /agent-vibes:learn
   ```

5. Check your setup:
   ```
   /agent-vibes:learn status
   ```

## Notes

- Translations are **direct translations** of what was said in the main language
- Same **personality/sentiment** applies to both languages
- Works with all AgentVibes features (personalities, etc.)
- Requires multilingual voices for target language (Antoni, Rachel, Domi, Bella, etc.)
- Small pause (0.5s) between main and target language announcements (if using TTS)

## Disable Learning Mode

```
/agent-vibes:learn off
```

This returns to normal single-language mode.




