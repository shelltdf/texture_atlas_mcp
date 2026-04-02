/**
 * Texture Atlas MCP（stdio）：供 Cursor / VS Code MCP 客户端调用。
 * 日志请用 console.error，勿向 stdout 打印无关内容。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'

const server = new McpServer({
  name: 'TextureAtlas',
  version: '0.0.1',
})

server.registerTool(
  'texture_atlas_ping',
  {
    description: 'Texture Atlas MCP 存活检测（与 frontend-vue 编辑器配套）',
    inputSchema: z.object({}),
  },
  async () => ({
    content: [{ type: 'text', text: 'TextureAtlas MCP ok' }],
  }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
