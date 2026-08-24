# Connecting Microsoft 365 Copilot Studio to the Helpdesk MCP Server

The helpdesk exposes a remote MCP server at `/api/mcp` with three tools:

- `search_lesson_learned` — search the Lesson Learned knowledge base, returns matches with a link
- `create_ticket` — create a support ticket on behalf of the authenticated user
- `list_tickets` — list tickets (admins see all, everyone else sees their own)

It uses the **Streamable HTTP** transport and authenticates via a Bearer token — both compatible with Copilot Studio's native MCP support (Copilot Studio only supports Streamable transport; SSE was dropped after August 2025).

## Prerequisite: the server must be publicly reachable

Copilot Studio runs in Microsoft's cloud and cannot reach `http://localhost:3000`. The app needs to actually be deployed (e.g. to Vercel) with a real HTTPS URL before Copilot Studio can connect to it at all — this is the first thing to resolve before touching the Copilot Studio UI.

## 1. Get an API token

1. Log into the helpdesk as the user you want the agent to act as.
2. Go to **Profile → API Tokens**.
3. Name the token (e.g. `Copilot Studio MCP`) and select **Generate token**.
4. Copy the token immediately — it's shown once and never again.

## 2. Add the MCP tool in Copilot Studio

In your agent in Copilot Studio:

1. Go to the agent's **Tools** page → **Add a tool** → **New tool** → **Model Context Protocol**.
2. Fill in the server details:
   - **Server name**: `Helpdesk`
   - **Server description**: e.g. "Search the helpdesk knowledge base, create tickets, and list tickets" — the agent orchestrator uses this text to decide when to call the server, so keep it accurate.
   - **Server URL**: `https://<your-deployed-domain>/api/mcp`
3. **Authentication type**: select **API key**
   - **Type**: `Header`
   - **Header name**: `Authorization`
   - **Key value**: `Bearer <your-token>` — include the literal `Bearer ` prefix as part of the value; the server checks for that exact prefix.
4. Select **Create**.
5. On the **Add tool** dialog, choose **Create a new connection**, then **Add to agent**.

## 3. Test it

- Ask something that matches an existing Lesson Learned entry (e.g. "How do I fix my VPN disconnecting?") — the agent should call `search_lesson_learned` and answer with a link back into the app.
- Ask something unrelated to anything in the knowledge base — the agent should report nothing was found and offer to file a ticket; confirming should trigger `create_ticket`.

## Note on authentication model

Copilot Studio's **API key** auth type is a single value entered once when the connection is created — it ties the whole agent to that one token/identity, not a per-Copilot-user login. Every user of that agent acts as the same helpdesk account.

If per-user attribution is actually needed (each Copilot Studio user mapped to their own helpdesk identity), that requires the **OAuth 2.0** authentication type instead, which needs an actual OAuth authorization server in front of the MCP server — a materially bigger change than the current static-token setup.

## Sources

- [Connect your agent to an existing Model Context Protocol (MCP) server – Microsoft Copilot Studio | Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
- [Extend agents with Model Context Protocol (MCP) in Copilot Studio | Microsoft Copilot Blog](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/introducing-model-context-protocol-mcp-in-copilot-studio-simplified-integration-with-ai-apps-and-agents/)
