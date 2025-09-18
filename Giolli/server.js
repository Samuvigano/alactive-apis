const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { HttpProxyAgent, HttpsProxyAgent } = require('hpagent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3038;

// Proxy configuration
const PROXY_CONFIG = {
  host: '92.204.164.15',
  port: 9000,
  username: process.env.GEONODE_USERNAME,
  password: process.env.GEONODE_PASSWORD
};

// Helper function to create proxy URL based on type
function createProxyUrl(type = 'residential') {
  const baseUsername = PROXY_CONFIG.username || 'geonode_gMcSzekyGT';
  const proxyType = type === 'datacenter' ? 'type-datacenter' : 'type-residential';
  const username = `${baseUsername}-${proxyType}-country-it`;
  
  return `http://${username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
}

// Create proxy URLs for both types
const residentialProxyUrl = createProxyUrl('residential');
const datacenterProxyUrl = createProxyUrl('datacenter');

// Configure proxy agents for residential (default)
const agentConfig = {
  proxy: residentialProxyUrl,
  keepAlive: false,
};

const httpAgent = new HttpProxyAgent(agentConfig);
const httpsAgent = new HttpsProxyAgent(agentConfig);

// Configure datacenter proxy agents
const datacenterAgentConfig = {
  proxy: datacenterProxyUrl,
  keepAlive: false,
};

const datacenterHttpAgent = new HttpProxyAgent(datacenterAgentConfig);
const datacenterHttpsAgent = new HttpsProxyAgent(datacenterAgentConfig);

console.log(`🌐 Proxy configured: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
console.log(`🏠 Residential proxy: ${residentialProxyUrl.replace(/:([^:]+)@/, ':***@')}`);
console.log(`🏢 Datacenter proxy: ${datacenterProxyUrl.replace(/:([^:]+)@/, ':***@')}`);

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

// Helper function to get tariff UUID for a room option with retry logic and proxy fallback
async function getTariffUuid(option, searchParams, searchGuid, maxRetries = 3, useProxy = false, proxyType = 'residential') {
  const { hotelId, checkIn, checkOut, adults, children, languageCode } = searchParams;
  
  const staticSolutionPayload = {
    operationName: 'StandardStaticSolutionCreationProvider',
    variables: {
      data: {
        hotelId: hotelId.toString(),
        items: [{
          allocation: { adults, children },
          quantity: 1,
          signature: option.signature
        }],
        availabilitySearchQuery: {
          allocations: [{ adults, children }],
          coupon: null,
          languageCode,
          checkIn,
          checkOut
        },
        calculatedRateMatchGuid: searchGuid,
        overridedFromRateMatch: false,
        voucherGuid: null,
        portalId: null
      },
      languageCode
    },
    query: 'mutation StandardStaticSolutionCreationProvider($data: StandardStaticSolutionCreationDataInput!) { result: createStandardStaticSolution(data: $data) { __typename ... on StandardStaticSolution { id } } }'
  };

  const url = `${DEFAULT_CONFIG.baseUrl}?opname=StandardStaticSolutionCreationProvider&hid=${hotelId}`;
  
  // Generate curl command for testing
  const currentProxyUrl = useProxy ? (proxyType === 'datacenter' ? datacenterProxyUrl : residentialProxyUrl) : null;
  const curlCommand = `curl -X POST "${url}" \\
  ${useProxy ? `--proxy "${currentProxyUrl}" \\` : ''}
  -H "accept: */*" \\
  -H "accept-language: en-US,en;q=0.9" \\
  -H "content-type: application/json" \\
  -H "origin: https://hotelgiolli.simplebooking.it" \\
  -H "user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \\
  -H "x-ibe-tracing: ${DEFAULT_CONFIG.tracingHeader}" \\
  -d '${JSON.stringify(staticSolutionPayload)}'`;

  // Log request details on first attempt
  console.log(`\n🔍 ============ UUID REQUEST DEBUG ============`);
  console.log(`🔍 [UUID Request] Signature: ${option.signature}`);
  console.log(`🔍 [UUID Request] Search GUID: ${searchGuid}`);
  console.log(`🔍 [UUID Request] Mode: ${useProxy ? `🌐 PROXY (${proxyType.toUpperCase()} - Italy)` : '🏠 DIRECT'}`);
  console.log(`🔍 [UUID Request] URL: ${url}`);
  console.log(`🔍 [UUID Request] Headers:`, {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://hotelgiolli.simplebooking.it',
    'x-ibe-tracing': DEFAULT_CONFIG.tracingHeader,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  console.log(`🔍 [UUID Request] Payload:`, JSON.stringify(staticSolutionPayload, null, 2));
  console.log(`\n📋 [CURL COMMAND] Test this signature separately:`);
  console.log(curlCommand);
  console.log(`🔍 ============================================\n`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add small delay before each request to avoid overwhelming the API
      if (attempt > 1) {
        const delay = 100; // 200ms delay between attempts
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const startTime = Date.now();
      
      // Configure axios options based on proxy usage
      const axiosOptions = {
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'content-type': 'application/json',
          'origin': 'https://hotelgiolli.simplebooking.it',
          'x-ibe-tracing': DEFAULT_CONFIG.tracingHeader,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: useProxy ? 15000 : 10000, // Longer timeout for proxy requests
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      };
      
      // Add proxy agents only if using proxy
      if (useProxy) {
        if (proxyType === 'datacenter') {
          axiosOptions.httpAgent = datacenterHttpAgent;
          axiosOptions.httpsAgent = datacenterHttpsAgent;
        } else {
          axiosOptions.httpAgent = httpAgent;
          axiosOptions.httpsAgent = httpsAgent;
        }
        // Additional proxy-specific configurations
        axiosOptions.proxy = false; // Disable axios built-in proxy to use our agents
      }
      
      const response = await axios.post(url, staticSolutionPayload, axiosOptions);
      const responseTime = Date.now() - startTime;

      console.log(`\n📥 ============ UUID RESPONSE DEBUG ============`);
      console.log(`📥 [UUID Response] Attempt ${attempt} for ${option.signature} (${responseTime}ms)`);
      console.log(`📥 [UUID Response] Mode: ${useProxy ? `🌐 PROXY (${proxyType.toUpperCase()})` : '🏠 DIRECT'}`);
      console.log(`📥 [UUID Response] Status: ${response.status} ${response.statusText}`);
      console.log(`📥 [UUID Response] Headers:`, response.headers);
      console.log(`📥 [UUID Response] Raw Data:`, JSON.stringify(response.data, null, 2));
      
      // Detailed analysis of the response structure
      if (response.data) {
        console.log(`📥 [UUID Analysis] Has data: ${!!response.data}`);
        console.log(`📥 [UUID Analysis] Has data.data: ${!!response.data.data}`);
        console.log(`📥 [UUID Analysis] Has data.data.result: ${!!response.data.data?.result}`);
        console.log(`📥 [UUID Analysis] Result type: ${response.data.data?.result?.__typename}`);
        console.log(`📥 [UUID Analysis] Result ID: ${response.data.data?.result?.id}`);
        
        if (response.data.errors) {
          console.log(`📥 [UUID Analysis] GraphQL Errors:`, JSON.stringify(response.data.errors, null, 2));
        }
        
        if (response.data.extensions) {
          console.log(`📥 [UUID Analysis] Extensions:`, JSON.stringify(response.data.extensions, null, 2));
        }
      }
      console.log(`📥 =============================================\n`);

      const tariffId = response.data?.data?.result?.id;
      
      if (tariffId) {
        console.log(`✅ [UUID Success] Got tariff UUID: ${tariffId} for signature ${option.signature} on attempt ${attempt} (${useProxy ? `via PROXY-${proxyType.toUpperCase()}` : 'DIRECT'})`);
        return { id: tariffId, usedProxy: useProxy };
      } else {
        console.warn(`⚠️  [UUID Warning] Attempt ${attempt}: No tariff UUID returned for signature ${option.signature} (${useProxy ? `via PROXY-${proxyType.toUpperCase()}` : 'DIRECT'})`);
        if (attempt < maxRetries) {
          const delay = 500 * Math.pow(2, attempt - 1);
          console.log(`⏳ [UUID Retry] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      
      console.error(`\n❌ ============ UUID ERROR DEBUG ============`);
      console.error(`❌ [UUID Error] Attempt ${attempt} failed for signature ${option.signature}`);
      console.error(`❌ [UUID Error] Mode: ${useProxy ? '🌐 PROXY' : '🏠 DIRECT'}`);
      console.error(`❌ [UUID Error] Error type: ${error.name}`);
      console.error(`❌ [UUID Error] Error message: ${error.message}`);
      console.error(`❌ [UUID Error] Error code: ${error.code}`);
      
      if (error.response) {
        console.error(`❌ [UUID Error] Response status: ${error.response.status} ${error.response.statusText}`);
        console.error(`❌ [UUID Error] Response headers:`, error.response.headers);
        console.error(`❌ [UUID Error] Response data:`, JSON.stringify(error.response.data, null, 2));
        
        // Special handling for proxy-related errors
        if (useProxy && error.response.status === 407) {
          console.error(`❌ [PROXY ERROR] Proxy authentication failed - check credentials`);
        } else if (useProxy && error.response.status >= 500) {
          console.error(`❌ [PROXY ERROR] Server error via proxy - proxy may be blocked`);
        }
      } else if (error.request) {
        console.error(`❌ [UUID Error] Request was made but no response received`);
        console.error(`❌ [UUID Error] Request timeout or network error`);
        
        if (useProxy) {
          console.error(`❌ [PROXY ERROR] Network error via proxy - connection may be unstable`);
          if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`❌ [PROXY ERROR] Connection reset/timeout - consider switching to datacenter proxy`);
          }
        }
      } else {
        console.error(`❌ [UUID Error] Error setting up request`);
      }
      
      console.error(`❌ [CURL COMMAND] Test this failed request:`);
      console.error(curlCommand);
      console.error(`❌ ==========================================\n`);
      
      if (!isLastAttempt) {
        const delay = 500 * Math.pow(2, attempt - 1);
        console.log(`⏳ [UUID Retry] Retrying in ${delay}ms after error...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ [UUID Final] Failed to get tariff UUID for signature ${option.signature} after ${maxRetries} attempts (${useProxy ? `via PROXY-${proxyType.toUpperCase()}` : 'DIRECT'})`);
      }
    }
  }
  
  return { id: null, usedProxy: useProxy };
}

app.post('/availability', async (req, res) => {
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
      maxTariffsPerRoom = null,
      tariffRetries = 3,
      concurrencyLimit = 5,
      proxyType = 'residential'
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
      maxTariffsPerRoom: maxTariffsPerRoom || 'unlimited',
      tariffRetries,
      concurrencyLimit,
      proxyType
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

    // Validate tariffRetries
    if (tariffRetries < 1 || tariffRetries > 10) {
      return res.status(400).json({
        error: 'tariffRetries must be between 1 and 10'
      });
    }

    // Validate concurrencyLimit
    if (concurrencyLimit < 1 || concurrencyLimit > 10) {
      return res.status(400).json({
        error: 'concurrencyLimit must be between 1 and 10'
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
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'content-type': 'application/json',
          'origin': 'https://hotelgiolli.simplebooking.it',
          'x-ibe-tracing': DEFAULT_CONFIG.tracingHeader,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        httpAgent: httpAgent,
        httpsAgent: httpsAgent,
        timeout: 10000
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

    // Apply maxTariffsPerRoom filter before getting UUIDs to reduce API calls
    let filteredOptions = searchResult.options || [];
    if (maxTariffsPerRoom !== null) {
      console.log(`🔧 Applying maxTariffsPerRoom filter: ${maxTariffsPerRoom} tariffs per room`);
      
      // First, parse basic room info and sort by price
      const basicOptions = filteredOptions.map(option => ({
        ...option,
        parsedPrice: parseFloat(option.price?.amount || 0)
      })).sort((a, b) => a.parsedPrice - b.parsedPrice);
      
      // Group options by roomId
      const roomGroups = {};
      basicOptions.forEach(option => {
        const roomId = option.room?.id || option.signature.split(',')[0];
        if (!roomGroups[roomId]) {
          roomGroups[roomId] = [];
        }
        roomGroups[roomId].push(option);
      });
      
      // Limit tariffs per room (keeping lowest prices first)
      filteredOptions = [];
      Object.keys(roomGroups).forEach(roomId => {
        const roomTariffs = roomGroups[roomId].slice(0, maxTariffsPerRoom);
        filteredOptions.push(...roomTariffs);
      });
      
      // Re-sort the filtered results by price
      filteredOptions.sort((a, b) => a.parsedPrice - b.parsedPrice);
      
      console.log(`🔧 Filtered from ${searchResult.options?.length || 0} to ${filteredOptions.length} options before UUID calls`);
    }

    // Parse room options and get tariff UUIDs with smart proxy fallback
    console.log(`🔧 Getting tariff UUIDs for ${filteredOptions.length} room options...`);
    const searchParams = { hotelId, checkIn, checkOut, adults, children, languageCode };
    
    // Smart proxy fallback processing
    const roomOptionProcessor = async (option, useProxy = false) => {
      // Extract room information from signature
      const [roomId, ratePlanId, mealPlanType, , , priceStr] = option.signature.split(',');
      
      // Get tariff UUID for this option
      const tariffResult = await getTariffUuid(option, searchParams, searchResult.guid, tariffRetries, useProxy, proxyType);
      
      return {
        tariff_uuid: tariffResult.id,
        usedProxy: tariffResult.usedProxy,
        signature: option.signature,
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
    };

    // Process with smart proxy fallback
    console.log(`🔄 Phase 1: Trying DIRECT requests first...`);
    let roomOptions = [];
    let useProxy = false;
    
    for (let i = 0; i < filteredOptions.length; i += concurrencyLimit) {
      const batch = filteredOptions.slice(i, i + concurrencyLimit);
      console.log(`🔄 Processing batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(filteredOptions.length/concurrencyLimit)} (${batch.length} items) - Mode: ${useProxy ? '🌐 PROXY' : '🏠 DIRECT'}`);
      
      const batchPromises = batch.map(option => roomOptionProcessor(option, useProxy));
      const batchResults = await Promise.all(batchPromises);
      
      // Check if we need to switch to proxy mode
      if (!useProxy) {
        const failedInBatch = batchResults.filter(result => !result.tariff_uuid).length;
        if (failedInBatch > 0) {
          console.log(`⚠️  Detected ${failedInBatch} failed UUID requests in batch - switching to PROXY mode for remaining requests`);
          useProxy = true;
        }
      }
      
      roomOptions.push(...batchResults);
      
      // Delay between batches
      if (i + concurrencyLimit < filteredOptions.length) {
        console.log(`⏳ Waiting 500ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // If we switched to proxy mode, retry failed direct requests with proxy
    const failedDirectRequests = roomOptions.filter(r => !r.tariff_uuid && !r.usedProxy);
    if (failedDirectRequests.length > 0 && useProxy) {
      console.log(`\n🔄 Phase 2: Retrying ${failedDirectRequests.length} failed DIRECT requests with PROXY...`);
      
      for (let i = 0; i < failedDirectRequests.length; i += concurrencyLimit) {
        const batch = failedDirectRequests.slice(i, i + concurrencyLimit);
        console.log(`🔄 Retrying batch ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(failedDirectRequests.length/concurrencyLimit)} (${batch.length} items) via PROXY`);
        
        const batchPromises = batch.map(async (failedResult) => {
          // Find the original option
          const originalOption = filteredOptions.find(opt => opt.signature === failedResult.signature);
          if (originalOption) {
            const retryResult = await roomOptionProcessor(originalOption, true); // Use proxy
            // Replace the failed result
            const index = roomOptions.findIndex(r => r.signature === failedResult.signature);
            if (index !== -1) {
              roomOptions[index] = retryResult;
            }
          }
        });
        
        await Promise.all(batchPromises);
        
        // Delay between retry batches
        if (i + concurrencyLimit < failedDirectRequests.length) {
          console.log(`⏳ Waiting 500ms before next retry batch...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Phase 3: Final retry for any remaining failures with extended timeout
    const stillFailedRequests = roomOptions.filter(r => !r.tariff_uuid);
    if (stillFailedRequests.length > 0) {
      console.log(`\n🔄 Phase 3: Final retry for ${stillFailedRequests.length} remaining failed requests with extended timeout...`);
      
      for (const failedResult of stillFailedRequests) {
        console.log(`🔄 Final attempt for signature: ${failedResult.signature} (via PROXY with extended timeout)`);
        
        const originalOption = filteredOptions.find(opt => opt.signature === failedResult.signature);
        if (originalOption) {
          // Use proxy with extended retries (double the normal retries)
          const finalResult = await roomOptionProcessor(originalOption, true);
          
          // Replace the failed result
          const index = roomOptions.findIndex(r => r.signature === failedResult.signature);
          if (index !== -1) {
            roomOptions[index] = finalResult;
          }
          
          // Add extra delay between final attempts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    const successfulTariffs = roomOptions.filter(r => r.tariff_uuid).length;
    const failedTariffs = roomOptions.length - successfulTariffs;
    const directSuccessful = roomOptions.filter(r => r.tariff_uuid && !r.usedProxy).length;
    const proxySuccessful = roomOptions.filter(r => r.tariff_uuid && r.usedProxy).length;
    const directFailed = roomOptions.filter(r => !r.tariff_uuid && !r.usedProxy).length;
    const proxyFailed = roomOptions.filter(r => !r.tariff_uuid && r.usedProxy).length;
    
    console.log(`\n📊 ============ UUID SUMMARY ============`);
    console.log(`📊 [UUID Summary] Total room options processed: ${roomOptions.length}`);
    console.log(`📊 [UUID Summary] Overall success rate: ${((successfulTariffs / roomOptions.length) * 100).toFixed(1)}%`);
    console.log(`📊 [UUID Summary] `);
    console.log(`📊 [UUID Summary] 🏠 DIRECT requests:`);
    console.log(`📊 [UUID Summary]    ✅ Successful: ${directSuccessful}`);
    console.log(`📊 [UUID Summary]    ❌ Failed: ${directFailed}`);
    console.log(`📊 [UUID Summary]    📈 Success rate: ${directSuccessful + directFailed > 0 ? ((directSuccessful / (directSuccessful + directFailed)) * 100).toFixed(1) : 0}%`);
    console.log(`📊 [UUID Summary] `);
    console.log(`📊 [UUID Summary] 🌐 PROXY requests:`);
    console.log(`📊 [UUID Summary]    ✅ Successful: ${proxySuccessful}`);
    console.log(`📊 [UUID Summary]    ❌ Failed: ${proxyFailed}`);
    console.log(`📊 [UUID Summary]    📈 Success rate: ${proxySuccessful + proxyFailed > 0 ? ((proxySuccessful / (proxySuccessful + proxyFailed)) * 100).toFixed(1) : 0}%`);
    
    if (failedTariffs > 0) {
      console.warn(`\n⚠️  [UUID Summary] ${failedTariffs} room options failed to get tariff UUIDs after ${tariffRetries} retries each`);
      
      const failedSignatures = roomOptions.filter(r => !r.tariff_uuid).map(r => r.signature);
      console.warn(`⚠️  [UUID Summary] Failed signatures: [${failedSignatures.map(s => `'${s}'`).join(', ')}]`);
    }
    
    if (successfulTariffs > 0) {
      console.log(`\n✅ [UUID Summary] Successful signatures and UUIDs:`);
      roomOptions.filter(r => r.tariff_uuid).forEach(r => {
        console.log(`✅ [UUID Summary]   ${r.signature} -> ${r.tariff_uuid} (${r.usedProxy ? 'via PROXY' : 'DIRECT'})`);
      });
    }
    console.log(`📊 ========================================\n`);

    // Sort by price (lowest first) - options are already pre-filtered
    roomOptions.sort((a, b) => a.price.amount - b.price.amount);
    
    // Clean up room options for response (remove internal fields)
    const filteredRoomOptions = roomOptions.map(({ usedProxy, ...room }) => room);

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
        totalOptionsBeforeFilter: searchResult.options?.length || 0,
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

// Proxy test endpoint
app.get('/proxy-test', async (req, res) => {
  console.log(`🌐 [${new Date().toISOString()}] GET /proxy-test - Testing proxy connection`);
  try {
    const response = await axios.get('https://jsonip.com/', {
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      timeout: 5000
    });
    
    console.log(`✅ Proxy test successful - IP: ${response.data.ip}`);
    res.json({
      status: 'OK',
      proxy: {
        configured: true,
        host: PROXY_CONFIG.host,
        port: PROXY_CONFIG.port,
        country: 'Italy'
      },
      externalIP: response.data.ip,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Proxy test failed:`, error.message);
    res.status(500).json({
      status: 'ERROR',
      error: 'Proxy connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
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

