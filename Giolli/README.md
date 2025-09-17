# Hotel Availability API Server

A Node.js/Express server that provides a simplified REST API interface for the hotel room availability GraphQL service.

## Features

- 🏨 **Hotel Room Search**: Search for available hotel rooms with flexible parameters
- 🔄 **Multiple Response Formats**: Raw GraphQL response or simplified, parsed data
- ✅ **Input Validation**: Comprehensive validation for dates, guest counts, and parameters
- 📚 **Auto Documentation**: Built-in API documentation endpoint
- 🛡️ **Error Handling**: Robust error handling with meaningful error messages
- 🌐 **CORS Support**: Cross-Origin Resource Sharing enabled
- ❤️ **Health Checks**: Built-in health monitoring endpoint
- 📊 **Comprehensive Logging**: Detailed request/response logging with performance metrics

## Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   # Production mode
   npm start
   
   # Development mode with auto-reload
   npm run dev
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### 1. POST `/api/hotel/availability`
**Full GraphQL response hotel availability search**

Returns the complete, unmodified GraphQL response from the hotel booking service.

**Request Body:**
```json
{
  "hotelId": "7376",
  "checkIn": "2025-09-19",
  "checkOut": "2025-09-20",
  "adults": 2,
  "children": [],
  "coupon": "",
  "languageCode": "IT",
  "timezoneMinutesOffset": 120
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:3000/api/hotel/availability \
  -H "Content-Type: application/json" \
  -d '{
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "adults": 2,
    "children": []
  }'
```

### 2. POST `/api/hotel/availability/simple`
**Simplified, parsed hotel availability search (Recommended)**

Returns a clean, simplified response with essential information only - much easier to work with!

**Request Body:** (Same as above)
```json
{
  "hotelId": "7376",
  "checkIn": "2025-09-19",
  "checkOut": "2025-09-20",
  "adults": 2,
  "children": [],
  "coupon": ""
}
```

**Parameters:**
- `checkIn` (required): Check-in date in YYYY-MM-DD format
- `checkOut` (required): Check-out date in YYYY-MM-DD format
- `hotelId` (optional): Hotel ID (default: "7376")
- `adults` (optional): Number of adults 1-10 (default: 2)
- `children` (optional): Array of children ages (default: [])
- `coupon` (optional): Promotional coupon code (default: "")
- `languageCode` (optional): Language code (default: "IT")
- `timezoneMinutesOffset` (optional): Timezone offset in minutes (default: 120)
- `maxTariffsPerRoom` (optional): Maximum tariffs per room 1-50 (default: unlimited, keeps lowest prices first)

**Example with curl:**
```bash
curl -X POST http://localhost:3000/api/hotel/availability/simple \
  -H "Content-Type: application/json" \
  -d '{
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "adults": 2,
    "children": []
  }'
```

**Example with children and coupon:**
```bash
curl -X POST http://localhost:3000/api/hotel/availability/simple \
  -H "Content-Type: application/json" \
  -d '{
    "checkIn": "2025-12-24",
    "checkOut": "2025-12-26",
    "adults": 2,
    "children": [8, 12],
    "coupon": "HOLIDAY2025"
  }'
```

**Example with maximum tariffs per room (limit to 3 cheapest tariffs per room):**
```bash
curl -X POST http://localhost:3000/api/hotel/availability/simple \
  -H "Content-Type: application/json" \
  -d '{
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "adults": 2,
    "maxTariffsPerRoom": 3
  }'
```

### 3. GET `/api/docs`
**API Documentation**

Returns complete API documentation with all endpoints, parameters, and examples.

### 4. GET `/health`
**Health Check**

Returns server health status and basic information.

### 5. GET `/`
**Root Endpoint**

Returns basic server information and links to documentation.

## Response Formats

### Raw GraphQL Response (POST `/api/hotel/availability`)
```json
{
  "success": true,
  "data": {
    "data": {
      "hotel": {
        "id": "7376",
        "result": {
          "guid": "cf8d2261-fdea-4845-92b1-ba216bd4f054",
          "options": [
            {
              "signature": "75597,30173,4,A,A,210.78,106551",
              "price": {
                "amount": 210.7755,
                "currencyCode": "EUR",
                "amountIncludesTaxes": true,
                "taxesPercent": 10,
                "__typename": "Price"
              },
              "room": { "id": "75597", "__typename": "Room" },
              "allocation": { "adults": 2, "children": [], "__typename": "RoomAllocation" }
            }
          ]
        }
      }
    }
  },
  "metadata": {
    "hotelId": "7376",
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "adults": 2,
    "children": [],
    "languageCode": "IT",
    "requestTime": "2025-09-17T15:10:37.131Z"
  }
}
```

### Simplified Response (POST `/api/hotel/availability/simple`) - **Recommended**
```json
{
  "success": true,
  "hotel": {
    "id": "7376",
    "searchGuid": "cf8d2261-fdea-4845-92b1-ba216bd4f054"
  },
  "search": {
    "checkIn": "2025-09-19",
    "checkOut": "2025-09-20",
    "nights": 1,
    "adults": 2,
    "children": [],
    "rateMatchEnabled": true
  },
  "coupon": {
    "recognized": false,
    "message": "Il codice promozionale inserito non è stato riconosciuto..."
  },
  "availability": {
    "hasRooms": true,
    "totalOptions": 22,
    "totalOptionsBeforeFilter": 35,
    "optionsMatchAllocation": true
  },
  "rooms": [
    {
      "roomId": "75597",
      "ratePlanId": "30173",
      "mealPlanId": "17002",
      "price": {
        "amount": 210.78,
        "currency": "EUR",
        "includesTaxes": true,
        "perNight": 210.78
      },
      "basePrice": {
        "amount": 324.27,
        "currency": "EUR",
        "perNight": 324.27
      },
      "discount": {
        "amount": 113.49,
        "percentage": 35
      },
      "availability": {
        "quantity": 1,
        "isLimited": true,
        "quantityLabel": "Ne resta solo 1"
      },
      "features": {
        "isSecret": false,
        "isLoyaltyOffer": false,
        "isExclusive": false
      }
    }
  ],
  "priceRange": {
    "lowest": {
      "amount": 210.78,
      "currency": "EUR",
      "perNight": 210.78
    },
    "highest": {
      "amount": 372.13,
      "currency": "EUR",
      "perNight": 372.13
    }
  },
  "requestTime": "2025-09-17T15:10:37.131Z"
}
```

### Error Response
```json
{
  "error": "checkIn and checkOut dates are required",
  "format": "YYYY-MM-DD"
}
```

## Key Benefits of the Simplified Endpoint

✅ **Clean Structure**: Organized into logical sections (hotel, search, availability, rooms)  
✅ **Essential Data Only**: Filters out GraphQL metadata and focuses on what matters  
✅ **Calculated Fields**: Adds useful computed values (nights, per-night prices, discounts)  
✅ **Sorted Results**: Rooms automatically sorted by price (lowest first)  
✅ **Price Analysis**: Includes price range and discount calculations  
✅ **Better Labels**: Converts cryptic responses into readable information  
✅ **Flexible Filtering**: Control number of tariffs per room while keeping best prices  

## Configuration

The server uses default configuration values that match the original GraphQL service:

- **Base URL**: `https://hotelgiolli.simplebooking.it/graphql/ibe2/graphql`
- **Default Hotel ID**: `7376`
- **Default Language**: `IT`
- **Default Timezone Offset**: `120` minutes
- **Default Adults**: `2`
- **Default Port**: `3000`

You can override the port by setting the `PORT` environment variable:
```bash
PORT=8080 npm start
```

## Validation Rules

- **Dates**: Must be in YYYY-MM-DD format
- **Date Logic**: Check-out must be after check-in
- **Adults**: Must be between 1 and 10
- **Children**: Array of ages (numbers)
- **Hotel ID**: String value
- **Language Code**: String value (default: "IT")
- **Max Tariffs Per Room**: Must be between 1 and 50 (optional)

## Error Handling

The API provides detailed error messages for:
- Missing required parameters
- Invalid date formats
- Invalid date logic (check-out before check-in)
- Invalid guest counts
- Network errors
- GraphQL API errors
- Server errors

## Logging

The server provides comprehensive logging including:
- Request/response timing
- Parameter validation
- API interaction status
- Error details with context
- Performance metrics

## Development

**Project Structure:**
```
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── sample_request.txt # Original curl request example
└── README.md         # This file
```

**Available Scripts:**
- `npm start`: Start the server in production mode
- `npm run dev`: Start the server in development mode with auto-reload (requires nodemon)

## Testing the API

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Test the simplified endpoint (recommended)**:
   ```bash
   curl -X POST http://localhost:3000/api/hotel/availability/simple \
     -H "Content-Type: application/json" \
     -d '{
       "checkIn": "2025-09-19",
       "checkOut": "2025-09-20",
       "adults": 2,
       "children": []
     }'
   ```

3. **Test the raw GraphQL response**:
   ```bash
   curl -X POST http://localhost:3000/api/hotel/availability \
     -H "Content-Type: application/json" \
     -d '{
       "checkIn": "2025-09-19",
       "checkOut": "2025-09-20",
       "adults": 2,
       "children": []
     }'
   ```

4. **Check API documentation**:
   ```bash
   curl http://localhost:3000/api/docs
   ```

## Dependencies

- **express**: Web framework for Node.js
- **cors**: Cross-Origin Resource Sharing middleware
- **axios**: HTTP client for making API requests
- **dotenv**: Environment variable loader

## License

MIT 