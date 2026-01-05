# Tools (client/server/MCP/system)

Tools allow ElevenLabs agents to perform actions beyond generating text responses. They enable agents to interact with external systems, execute custom logic, or access specific functionalities during a conversation.

## Types
- Client Tools: run on the client-side app (web/mobile)
- Server Tools: run on your server via API calls
- MCP Tools: tools/resources provided by MCP servers
- System Tools: built-in platform tools

## Guidance
- Keep tool names and parameter schemas consistent between agent config and implementation.
- Use blocking tools when the agent must wait for the tool result.
- Use client tools for UI/navigation; use server tools for secure operations.
