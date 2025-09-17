#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

// MCP Server configuration
const server = new Server(
  {
    name: 'hotel-availability-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Default API configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEFAULT_HOTEL_ID = '7376';

// Helper function to validate date format
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_hotel_availability',
        description: 'Search for hotel room availability with simplified, parsed response',
        inputSchema: {
          type: 'object',
          properties: {
            checkIn: {
              type: 'string',
              description: 'Check-in date in YYYY-MM-DD format',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            checkOut: {
              type: 'string',
              description: 'Check-out date in YYYY-MM-DD format',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            adults: {
              type: 'integer',
              description: 'Number of adults (1-10)',
              minimum: 1,
              maximum: 10,
              default: 2
            },
            children: {
              type: 'array',
              description: 'Array of children ages',
              items: {
                type: 'integer',
                minimum: 0,
                maximum: 17
              },
              default: []
            },
            hotelId: {
              type: 'string',
              description: 'Hotel ID',
              default: DEFAULT_HOTEL_ID
            },
            coupon: {
              type: 'string',
              description: 'Promotional coupon code',
              default: ''
            },
            maxTariffsPerRoom: {
              type: 'integer',
              description: 'Maximum number of tariffs to return per room (keeps lowest prices first)',
              minimum: 1,
              maximum: 50
            },
            languageCode: {
              type: 'string',
              description: 'Language code',
              default: 'IT'
            }
          },
          required: ['checkIn', 'checkOut']
        }
      },
      {
        name: 'get_api_health',
        description: 'Check the health status of the hotel availability API',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_api_documentation',
        description: 'Get the API documentation and available endpoints',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_hotel_availability': {
        const {
          checkIn,
          checkOut,
          adults = 2,
          children = [],
          hotelId = DEFAULT_HOTEL_ID,
          coupon = '',
          maxTariffsPerRoom,
          languageCode = 'IT'
        } = args;

        // Validate required fields
        if (!checkIn || !checkOut) {
          throw new Error('checkIn and checkOut dates are required');
        }

        // Validate date format
        if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
          throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        // Validate date logic
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (checkOutDate <= checkInDate) {
          throw new Error('checkOut date must be after checkIn date');
        }

        // Validate adults
        if (adults < 1 || adults > 10) {
          throw new Error('adults must be between 1 and 10');
        }

        // Validate maxTariffsPerRoom if provided
        if (maxTariffsPerRoom !== undefined && (maxTariffsPerRoom < 1 || maxTariffsPerRoom > 50)) {
          throw new Error('maxTariffsPerRoom must be between 1 and 50');
        }

        // Prepare request payload
        const payload = {
          hotelId,
          checkIn,
          checkOut,
          adults,
          children,
          coupon,
          languageCode,
          timezoneMinutesOffset: 120
        };

        if (maxTariffsPerRoom !== undefined) {
          payload.maxTariffsPerRoom = maxTariffsPerRoom;
        }

        // Make API request
        const response = await axios.post(`${API_BASE_URL}/api/hotel/availability/simple`, payload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'get_api_health': {
        const response = await axios.get(`${API_BASE_URL}/health`, {
          timeout: 10000 // 10 second timeout
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'get_api_documentation': {
        const response = await axios.get(`${API_BASE_URL}/api/docs`, {
          timeout: 10000 // 10 second timeout
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    let errorMessage = `Error executing ${name}: ${error.message}`;
    
    if (error.response) {
      // API returned an error response
      errorMessage += `\nAPI Response Status: ${error.response.status}`;
      if (error.response.data) {
        errorMessage += `\nAPI Response: ${JSON.stringify(error.response.data, null, 2)}`;
      }
    } else if (error.request) {
      // Network error
      errorMessage += '\nNetwork error: Unable to connect to the API server';
      errorMessage += `\nEnsure the API server is running at ${API_BASE_URL}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorMessage
        }
      ],
      isError: true
    };
  }
});

// Start the MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hotel Availability MCP Server started');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

module.exports = { server }; 