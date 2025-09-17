 # Hotel Availability MCP Server

This is a Model Context Protocol (MCP) server that exposes the Hotel Availability API as MCP tools, allowing AI assistants to search for hotel room availability directly.

## What is MCP?

Model Context Protocol (MCP) is an open standard that allows AI assistants to securely connect to data sources and tools. This MCP server makes your hotel availability API accessible to compatible AI assistants like Claude Desktop.

## Features

The MCP server exposes three main tools:

1. **search_hotel_availability** - Search for hotel room availability with simplified response
2. **get_api_health** - Check the health status of the hotel API
3. **get_api_documentation** - Get API documentation and available endpoints

## Setup

### 1. Install Dependencies

```bash
npm install @modelcontextprotocol/sdk
```

### 2. Start the Hotel API Server

First, make sure your main hotel availability API is running:

```bash
npm start
```

The API should be accessible at `http://localhost:3000`

### 3. Test the MCP Server

You can test the MCP server directly:

```bash
npm run mcp
```

### 4. Configure with Claude Desktop (or other MCP-compatible clients)

Add the following configuration to your MCP client configuration file:

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "hotel-availability": {
      "command": "node",
      "args": ["/path/to/your/project/mcp-server.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `/path/to/your/project/` with the actual path to your project directory.

## Usage Examples

Once configured with an MCP-compatible AI assistant, you can use natural language commands like:

- "Search for hotel availability from 2025-09-19 to 2025-09-20 for 2 adults"
- "Check hotel availability for next weekend with 2 adults and 1 child aged 8"
- "Find the cheapest rooms available for December 25-27"
- "Check the API health status"
- "Show me the API documentation"

## Tool Parameters

### search_hotel_availability

- **checkIn** (required): Check-in date in YYYY-MM-DD format
- **checkOut** (required): Check-out date in YYYY-MM-DD format
- **adults** (optional): Number of adults (1-10, default: 2)
- **children** (optional): Array of children ages (default: [])
- **hotelId** (optional): Hotel ID (default: "7376")
- **coupon** (optional): Promotional coupon code
- **maxTariffsPerRoom** (optional): Maximum tariffs per room (1-50)
- **languageCode** (optional): Language code (default: "IT")

### get_api_health

No parameters required.

### get_api_documentation

No parameters required.

## Environment Variables

- **API_BASE_URL**: Base URL of the hotel availability API (default: http://localhost:3000)

## Response Format

The MCP server returns the same simplified response format as the `/api/hotel/availability/simple` endpoint:

```json
{
  "success": true,
  "hotel": {
    "id": "7376",
    "searchGuid": "..."
  },
  "search": {
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "nights": 1,
    "adults": 2,
    "children": []
  },
  "availability": {
    "hasRooms": true,
    "totalOptions": 15
  },
  "rooms": [
    {
      "roomId": "...",
      "price": {
        "amount": 120.00,
        "currency": "EUR",
        "perNight": 120.00
      },
      "availability": {
        "quantity": 5,
        "isLimited": false
      }
    }
  ],
  "priceRange": {
    "lowest": { "amount": 120.00, "currency": "EUR" },
    "highest": { "amount": 250.00, "currency": "EUR" }
  }
}
```

## Troubleshooting

1. **MCP Server won't start**: Ensure you have installed the MCP SDK dependency
2. **API connection errors**: Make sure the main hotel API server is running on port 3000
3. **Configuration issues**: Check that the path in your MCP client configuration is correct
4. **Permission errors**: Ensure the mcp-server.js file has execute permissions

## Development

For development with auto-restart:

```bash
npm run mcp:dev
```

This uses nodemon to automatically restart the MCP server when files change.

## Security Notes

- The MCP server connects to your local hotel API server
- Ensure your API server has appropriate rate limiting and validation
- Consider adding authentication if deploying in production environments
- The MCP server inherits the security model of your underlying API