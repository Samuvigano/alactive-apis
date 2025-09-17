const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// GraphQL query template
const GRAPHQL_QUERY = `query StandardAvailabilitySearchProvider($hotelId: ID!, $query: StandardAvailabilitySearchQueryInput!, $languageCode: ID!, $timezoneMinutesOffset: Int!) { 
  hotel(id: $hotelId) { 
    id 
    result: standardAvailabilitySearch(query: $query) { 
      guid 
      rateMatchEnabled 
      noAvailabilityRoomsHTML(languageCode: $languageCode) 
      coupon { 
        affiliatedEntity { 
          ...StandardAvailabilitySearchProviderAffiliatedEntity 
          __typename 
        } 
        recognized 
        unrecognizedMessage(languageCode: $languageCode timezoneMinutesOffset: $timezoneMinutesOffset) 
        __typename 
      } 
      options { 
        signature 
        affiliatedEntity { 
          ...StandardAvailabilitySearchProviderAffiliatedEntity 
          __typename 
        } 
        allocation { 
          adults 
          children 
          __typename 
        } 
        isSecret 
        isLoayltyClubOffer 
        isExclusive 
        availableQuantity 
        forNightsLabel(languageCode: $languageCode) 
        roomTypeAvailableQuantity 
        roomTypeAvailableQuantityLabel(languageCode: $languageCode) 
        extraGuestsLabel(languageCode: $languageCode) 
        price { 
          ...StandardAvailabilitySearchProviderPrice 
          __typename 
        } 
        basePrice { 
          ...StandardAvailabilitySearchProviderPrice 
          __typename 
        } 
        dailyPrice { 
          ...StandardAvailabilitySearchProviderDailyPrice 
          __typename 
        } 
        cancellationPolicy { 
          id 
          __typename 
        } 
        mealPlan { 
          id 
          __typename 
        } 
        offer { 
          id 
          __typename 
        } 
        ratePlan { 
          id 
          __typename 
        } 
        room { 
          id 
          __typename 
        } 
        __typename 
      } 
      optionsMatchRequestedAllocation 
      __typename 
    } 
    __typename 
  } 
} 
fragment StandardAvailabilitySearchProviderAffiliatedEntity on AffiliatedEntity { 
  __typename 
  ... on AffiliatedAgency { 
    id 
    name 
    __typename 
  } 
  ... on AffiliatedCompany { 
    id 
    name 
    __typename 
  } 
} 
fragment StandardAvailabilitySearchProviderPrice on Price { 
  amount 
  amountIncludesTaxes 
  currencyCode 
  taxesPercent 
  __typename 
} 
fragment StandardAvailabilitySearchProviderDailyPrice on RoomOptionDailyPrice { 
  averagePricePerNight { 
    ...StandardAvailabilitySearchProviderPrice 
    __typename 
  } 
  rates { 
    date 
    price { 
      ...StandardAvailabilitySearchProviderPrice 
      __typename 
    } 
    basePrice { 
      ...StandardAvailabilitySearchProviderPrice 
      __typename 
    } 
    __typename 
  } 
  __typename 
}`;

// Default configuration
const DEFAULT_CONFIG = {
  baseUrl: 'https://hotelgiolli.simplebooking.it/graphql/ibe2/graphql',
  hotelId: '7376',
  languageCode: 'IT',
  timezoneMinutesOffset: 120,
  tracingHeader: '308634|$2a$07$whOL4Zdb.6EdqKYo9wfq5O6nrOc1W1/rOVDAELfvOBKCRRBrVs7i2'
};

// Helper function to format date to YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper function to validate date format
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString === formatDate(date);
}

// Main API endpoint for hotel availability search
app.post('/api/hotel/availability', async (req, res) => {
  const startTime = Date.now();
  console.log(`🔍 [${new Date().toISOString()}] POST /api/hotel/availability - Request received`);
  
  try {
    const {
      hotelId = DEFAULT_CONFIG.hotelId,
      checkIn,
      checkOut,
      adults = 2,
      children = [],
      coupon = '',
      languageCode = DEFAULT_CONFIG.languageCode,
      timezoneMinutesOffset = DEFAULT_CONFIG.timezoneMinutesOffset
    } = req.body;

    console.log(`📋 Request parameters:`, {
      hotelId,
      checkIn,
      checkOut,
      adults,
      children: children.length > 0 ? children : 'none',
      coupon: coupon || 'none',
      languageCode,
      timezoneMinutesOffset
    });

    // Validate required fields
    if (!checkIn || !checkOut) {
      console.log(`❌ Validation failed: Missing required dates`);
      return res.status(400).json({
        error: 'checkIn and checkOut dates are required',
        format: 'YYYY-MM-DD'
      });
    }

    // Validate date format
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
        checkIn,
        checkOut
      });
    }

    // Validate date logic
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        error: 'checkOut date must be after checkIn date'
      });
    }

    // Validate adults
    if (adults < 1 || adults > 10) {
      return res.status(400).json({
        error: 'adults must be between 1 and 10'
      });
    }

    // Prepare GraphQL request
    const graphqlPayload = {
      operationName: 'StandardAvailabilitySearchProvider',
      variables: {
        hotelId: hotelId.toString(),
        languageCode,
        timezoneMinutesOffset,
        query: {
          allocations: [{
            adults,
            children
          }],
          coupon,
          languageCode,
          checkIn,
          checkOut
        }
      },
      query: GRAPHQL_QUERY
    };

    // Make request to the GraphQL endpoint
    console.log(`🚀 Making GraphQL request to hotel booking service...`);
    const response = await axios.post(
      `${DEFAULT_CONFIG.baseUrl}?opname=StandardAvailabilitySearchProvider&hid=${hotelId}`,
      graphqlPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://hotelgiolli.simplebooking.it',
          'X-IBE-Tracing': DEFAULT_CONFIG.tracingHeader
        }
      }
    );
    console.log(`✅ GraphQL request completed successfully`);

    // Return the response
    const responseTime = Date.now() - startTime;
    console.log(`✅ Request completed successfully in ${responseTime}ms`);
    res.json({
      success: true,
      data: response.data,
      metadata: {
        hotelId,
        checkIn,
        checkOut,
        adults,
        children,
        languageCode,
        requestTime: new Date().toISOString()
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching hotel availability (${responseTime}ms):`, error.message);
    
    if (error.response) {
      // GraphQL API returned an error
      console.error(`🔴 GraphQL API error - Status: ${error.response.status}`, error.response.data);
      res.status(error.response.status).json({
        error: 'API request failed',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // Network error
      console.error(`🔴 Network error - Unable to connect to hotel booking service`);
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to connect to hotel booking service'
      });
    } else {
      // Other error
      console.error(`🔴 Internal server error:`, error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Simplified API endpoint that returns parsed availability data
app.post('/api/hotel/availability/simple', async (req, res) => {
  const startTime = Date.now();
  console.log(`🔍 [${new Date().toISOString()}] POST /api/hotel/availability/simple - Request received`);
  
  try {
    const {
      hotelId = DEFAULT_CONFIG.hotelId,
      checkIn,
      checkOut,
      adults = 2,
      children = [],
      coupon = '',
      languageCode = DEFAULT_CONFIG.languageCode,
      timezoneMinutesOffset = DEFAULT_CONFIG.timezoneMinutesOffset,
      maxTariffsPerRoom = null
    } = req.body;

    console.log(`📋 Request parameters:`, {
      hotelId,
      checkIn,
      checkOut,
      adults,
      children: children.length > 0 ? children : 'none',
      coupon: coupon || 'none',
      languageCode,
      timezoneMinutesOffset,
      maxTariffsPerRoom: maxTariffsPerRoom || 'unlimited'
    });

    // Validate required fields
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        error: 'checkIn and checkOut dates are required',
        format: 'YYYY-MM-DD'
      });
    }

    // Validate date format
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
        checkIn,
        checkOut
      });
    }

    // Validate date logic
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        error: 'checkOut date must be after checkIn date'
      });
    }

    // Validate adults
    if (adults < 1 || adults > 10) {
      return res.status(400).json({
        error: 'adults must be between 1 and 10'
      });
    }

    // Validate maxTariffsPerRoom
    if (maxTariffsPerRoom !== null && (maxTariffsPerRoom < 1 || maxTariffsPerRoom > 50)) {
      return res.status(400).json({
        error: 'maxTariffsPerRoom must be between 1 and 50'
      });
    }

    // Prepare GraphQL request
    const graphqlPayload = {
      operationName: 'StandardAvailabilitySearchProvider',
      variables: {
        hotelId: hotelId.toString(),
        languageCode,
        timezoneMinutesOffset,
        query: {
          allocations: [{
            adults,
            children
          }],
          coupon,
          languageCode,
          checkIn,
          checkOut
        }
      },
      query: GRAPHQL_QUERY
    };

    // Make request to the GraphQL endpoint
    const response = await axios.post(
      `${DEFAULT_CONFIG.baseUrl}?opname=StandardAvailabilitySearchProvider&hid=${hotelId}`,
      graphqlPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://hotelgiolli.simplebooking.it',
          'X-IBE-Tracing': DEFAULT_CONFIG.tracingHeader
        }
      }
    );

    // Parse and simplify the response
    console.log(`🔧 Parsing and simplifying GraphQL response...`);
    const hotelData = response.data?.data?.hotel;
    const searchResult = hotelData?.result;

    if (!hotelData || !searchResult) {
      console.log(`❌ No hotel data found in response`);
      return res.status(404).json({
        error: 'No hotel data found',
        hotelId
      });
    }

    // Calculate nights
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    console.log(`📊 Found ${searchResult.options?.length || 0} room options for ${nights} night${nights > 1 ? 's' : ''}`);

    // Parse room options
    const roomOptions = (searchResult.options || []).map(option => {
      // Extract room information from signature
      const [roomId, ratePlanId, mealPlanType, , , priceStr] = option.signature.split(',');
      
      return {
        roomId: option.room?.id || roomId,
        ratePlanId: option.ratePlan?.id || ratePlanId,
        mealPlanId: option.mealPlan?.id,
        offerId: option.offer?.id,
        cancellationPolicyId: option.cancellationPolicy?.id,
        
        // Pricing information
        price: {
          amount: parseFloat(option.price?.amount || 0),
          currency: option.price?.currencyCode || 'EUR',
          includesTaxes: option.price?.amountIncludesTaxes || false,
          taxesPercent: option.price?.taxesPercent || 0,
          perNight: parseFloat(option.price?.amount || 0) / nights
        },
        
        basePrice: option.basePrice ? {
          amount: parseFloat(option.basePrice.amount || 0),
          currency: option.basePrice.currencyCode || 'EUR',
          includesTaxes: option.basePrice.amountIncludesTaxes || false,
          taxesPercent: option.basePrice.taxesPercent || 0,
          perNight: parseFloat(option.basePrice.amount || 0) / nights
        } : null,
        
        // Discount information
        discount: option.basePrice ? {
          amount: parseFloat(option.basePrice.amount) - parseFloat(option.price.amount),
          percentage: Math.round(((parseFloat(option.basePrice.amount) - parseFloat(option.price.amount)) / parseFloat(option.basePrice.amount)) * 100)
        } : null,
        
        // Availability
        availability: {
          quantity: option.availableQuantity || 0,
          roomTypeQuantity: option.roomTypeAvailableQuantity || 0,
          quantityLabel: option.roomTypeAvailableQuantityLabel || '',
          isLimited: (option.roomTypeAvailableQuantity || 0) <= 3
        },
        
        // Guest allocation
        allocation: {
          adults: option.allocation?.adults || adults,
          children: option.allocation?.children || children
        },
        
        // Room features
        features: {
          isSecret: option.isSecret || false,
          isLoyaltyOffer: option.isLoayltyClubOffer || false,
          isExclusive: option.isExclusive || false
        },
        
        // Labels
        labels: {
          forNights: option.forNightsLabel || `per ${nights} notte${nights > 1 ? 'i' : ''}`,
          extraGuests: option.extraGuestsLabel || null
        }
      };
    });

    // Sort by price (lowest first)
    roomOptions.sort((a, b) => a.price.amount - b.price.amount);

    // Apply maxTariffsPerRoom filter if specified
    let filteredRoomOptions = roomOptions;
    if (maxTariffsPerRoom !== null) {
      console.log(`🔧 Applying maxTariffsPerRoom filter: ${maxTariffsPerRoom} tariffs per room`);
      
      // Group options by roomId
      const roomGroups = {};
      roomOptions.forEach(option => {
        if (!roomGroups[option.roomId]) {
          roomGroups[option.roomId] = [];
        }
        roomGroups[option.roomId].push(option);
      });
      
      // Limit tariffs per room (keeping lowest prices first)
      filteredRoomOptions = [];
      Object.keys(roomGroups).forEach(roomId => {
        const roomTariffs = roomGroups[roomId].slice(0, maxTariffsPerRoom);
        filteredRoomOptions.push(...roomTariffs);
      });
      
      // Re-sort the filtered results by price
      filteredRoomOptions.sort((a, b) => a.price.amount - b.price.amount);
      
      console.log(`🔧 Filtered from ${roomOptions.length} to ${filteredRoomOptions.length} options`);
    }

    // Prepare simplified response
    const simplifiedResponse = {
      success: true,
      hotel: {
        id: hotelData.id,
        searchGuid: searchResult.guid
      },
      search: {
        checkIn,
        checkOut,
        nights,
        adults,
        children,
        rateMatchEnabled: searchResult.rateMatchEnabled || false
      },
      coupon: {
        recognized: searchResult.coupon?.recognized || false,
        message: searchResult.coupon?.unrecognizedMessage || null
      },
      availability: {
        hasRooms: filteredRoomOptions.length > 0,
        totalOptions: filteredRoomOptions.length,
        totalOptionsBeforeFilter: roomOptions.length,
        optionsMatchAllocation: searchResult.optionsMatchRequestedAllocation || false,
        noAvailabilityMessage: searchResult.noAvailabilityRoomsHTML || null
      },
      rooms: filteredRoomOptions,
      priceRange: filteredRoomOptions.length > 0 ? {
        lowest: {
          amount: filteredRoomOptions[0].price.amount,
          currency: filteredRoomOptions[0].price.currency,
          perNight: filteredRoomOptions[0].price.perNight
        },
        highest: {
          amount: filteredRoomOptions[filteredRoomOptions.length - 1].price.amount,
          currency: filteredRoomOptions[filteredRoomOptions.length - 1].price.currency,
          perNight: filteredRoomOptions[filteredRoomOptions.length - 1].price.perNight
        }
      } : null,
      requestTime: new Date().toISOString()
    };

    const responseTime = Date.now() - startTime;
    console.log(`✅ Simplified request completed successfully in ${responseTime}ms - ${filteredRoomOptions.length} options returned`);
    res.json(simplifiedResponse);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching simplified hotel availability (${responseTime}ms):`, error.message);
    
    if (error.response) {
      // GraphQL API returned an error
      console.error(`🔴 GraphQL API error - Status: ${error.response.status}`, error.response.data);
      res.status(error.response.status).json({
        error: 'API request failed',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // Network error
      console.error(`🔴 Network error - Unable to connect to hotel booking service`);
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to connect to hotel booking service'
      });
    } else {
      // Other error
      console.error(`🔴 Internal server error:`, error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log(`❤️ [${new Date().toISOString()}] GET /health - Health check requested`);
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Hotel Availability API',
    version: '1.0.0'
  });
});


// API documentation endpoint
app.get('/api/docs', (req, res) => {
  console.log(`📖 [${new Date().toISOString()}] GET /api/docs - Documentation requested`);
  res.json({
    title: 'Hotel Availability API',
    version: '1.0.0',
    description: 'API for searching hotel room availability',
    endpoints: {
      'POST /api/hotel/availability': {
        description: 'Search for hotel room availability (raw GraphQL response)',
        parameters: {
          hotelId: { type: 'string', default: '7376', description: 'Hotel ID' },
          checkIn: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Check-in date' },
          checkOut: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Check-out date' },
          adults: { type: 'number', default: 2, min: 1, max: 10, description: 'Number of adults' },
          children: { type: 'array', default: [], description: 'Array of children ages' },
          coupon: { type: 'string', default: '', description: 'Promotional coupon code' },
          languageCode: { type: 'string', default: 'IT', description: 'Language code' },
          timezoneMinutesOffset: { type: 'number', default: 120, description: 'Timezone offset in minutes' }
        },
        example: {
          hotelId: '7376',
          checkIn: '2025-09-19',
          checkOut: '2025-09-20',
          adults: 2,
          children: [],
          coupon: ''
        }
      },
      'POST /api/hotel/availability/simple': {
        description: 'Search for hotel room availability (simplified, parsed response)',
        parameters: {
          hotelId: { type: 'string', default: '7376', description: 'Hotel ID' },
          checkIn: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Check-in date' },
          checkOut: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Check-out date' },
          adults: { type: 'number', default: 2, min: 1, max: 10, description: 'Number of adults' },
          children: { type: 'array', default: [], description: 'Array of children ages' },
          coupon: { type: 'string', default: '', description: 'Promotional coupon code' },
          languageCode: { type: 'string', default: 'IT', description: 'Language code' },
          timezoneMinutesOffset: { type: 'number', default: 120, description: 'Timezone offset in minutes' },
          maxTariffsPerRoom: { type: 'number', default: null, min: 1, max: 50, description: 'Maximum number of tariffs to return per room (keeps lowest prices first)' }
        },
        example: {
          hotelId: '7376',
          checkIn: '2025-09-19',
          checkOut: '2025-09-20',
          adults: 2,
          children: [],
          coupon: '',
          maxTariffsPerRoom: 3
        },
        response: {
          description: 'Returns a clean, simplified structure with essential room and pricing information',
          structure: {
            success: 'boolean',
            hotel: { id: 'string', searchGuid: 'string' },
            search: { checkIn: 'date', checkOut: 'date', nights: 'number', adults: 'number', children: 'array' },
            availability: { hasRooms: 'boolean', totalOptions: 'number' },
            rooms: [{ 
              roomId: 'string', 
              price: { amount: 'number', currency: 'string', perNight: 'number' },
              discount: { amount: 'number', percentage: 'number' },
              availability: { quantity: 'number', isLimited: 'boolean' }
            }],
            priceRange: { lowest: 'object', highest: 'object' }
          }
        }
      },

      'GET /health': {
        description: 'Health check endpoint'
      },
      'GET /api/docs': {
        description: 'API documentation'
      }
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log(`🏠 [${new Date().toISOString()}] GET / - Root endpoint accessed`);
  res.json({
    message: 'Hotel Availability API Server',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hotel Availability API Server running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Quick Examples:`);
  console.log(`   POST http://localhost:${PORT}/api/hotel/availability (raw response)`);
  console.log(`   POST http://localhost:${PORT}/api/hotel/availability/simple (simplified)`);
  console.log(`   GET  http://localhost:${PORT}/api/hotel/availability/2025-09-19/2025-09-20`);
  console.log(`   GET  http://localhost:${PORT}/api/hotel/availability/2025-09-19/2025-09-20?adults=2&children=8,12`);
});

module.exports = app;

