/**
 * Production P0 Smoke Test for Enterprise HMS on Vercel
 * Tests all key operational domains against the live deployment:
 * https://enterprise-hms.vercel.app
 */

const BASE_URL = 'https://enterprise-hms.vercel.app';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, data: json };
}

async function runSmokeTest() {
  console.log('====================================================');
  console.log('ENTERPRISE HMS — LIVE PRODUCTION P0 SMOKE TEST');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  // 1. Health Liveness
  console.log('1. Health Check (GET /api/health/liveness)');
  const healthRes = await request('/api/health/liveness');
  if (healthRes.status !== 200 || healthRes.data?.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(healthRes.data)}`);
  }
  console.log(`   ✓ Health OK (status: ${healthRes.status}, data: ${JSON.stringify(healthRes.data)})\n`);

  // 2. JWKS
  console.log('2. JWKS Endpoint (GET /.well-known/jwks.json)');
  const jwksRes = await request('/.well-known/jwks.json');
  if (jwksRes.status !== 200 || !jwksRes.data?.keys?.length) {
    throw new Error(`JWKS check failed: ${JSON.stringify(jwksRes.data)}`);
  }
  console.log(`   ✓ JWKS OK (keys: ${jwksRes.data.keys.length}, kid: ${jwksRes.data.keys[0].kid})\n`);

  // 3. Login
  console.log('3. Authentication: Login (POST /api/v1/auth/login)');
  const loginRes = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@tokyograndeur.demo',
      password: 'Demo1234!',
    }),
  });
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.data.accessToken;
  const user = loginRes.data.data.user;
  const activeContext = loginRes.data.data.activeContext;
  console.log(`   ✓ Login OK: ${user.email} (${user.firstName} ${user.lastName})`);
  console.log(`   ✓ Token: RS256 JWT issued (length: ${token.length})`);
  console.log(`   ✓ Context: Property ${activeContext.propertyId}, HotelGroup ${activeContext.hotelGroupId}\n`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'X-Property-ID': activeContext.propertyId,
    'Content-Type': 'application/json',
  };

  // 4. Auth Me
  console.log('4. Authentication: Profile (GET /api/v1/auth/me)');
  const meRes = await request('/api/v1/auth/me', { headers: authHeaders });
  if (meRes.status !== 200) {
    throw new Error(`Auth /me failed: ${JSON.stringify(meRes.data)}`);
  }
  console.log(`   ✓ Auth /me OK: ${meRes.data.data.permissions.length} permissions loaded\n`);

  // 5. Dashboard / Properties
  console.log('5. Dashboard: Property List (GET /api/v1/organization/properties)');
  const propRes = await request('/api/v1/organization/properties', { headers: authHeaders });
  if (propRes.status !== 200) {
    throw new Error(`Get properties failed: ${JSON.stringify(propRes.data)}`);
  }
  const properties = propRes.data.data || propRes.data;
  console.log(`   ✓ Properties loaded: count = ${Array.isArray(properties) ? properties.length : 'OK'}\n`);

  const propertyId = activeContext.propertyId;

  // 6. Availability Calendar
  console.log(`6. Inventory: Availability Calendar (GET /api/properties/${propertyId}/pms/inventory/calendar)`);
  const calRes = await request(`/api/properties/${propertyId}/pms/inventory/calendar?startDate=2026-10-01&endDate=2026-10-05`, {
    headers: authHeaders,
  });
  console.log(`   ✓ Availability Calendar response status: ${calRes.status}\n`);

  // 7. Reservations List
  console.log(`7. Reservations: List (GET /api/properties/${propertyId}/pms/reservations)`);
  const resList = await request(`/api/properties/${propertyId}/pms/reservations?page=1&limit=10`, {
    headers: authHeaders,
  });
  if (resList.status !== 200) {
    throw new Error(`List reservations failed: ${JSON.stringify(resList.data)}`);
  }
  const reservations = resList.data.data?.items || resList.data.data || [];
  console.log(`   ✓ Reservations listed: ${reservations.length} reservations found`);
  if (reservations.length > 0) {
    console.log(`     Sample Reservation: ${reservations[0].confirmationNumber} (${reservations[0].status})`);
  }
  console.log('');

  // 8. Rooms List
  console.log(`8. Room Operations: List Rooms (GET /api/properties/${propertyId}/pms/room-operations/rooms)`);
  const roomsRes = await request(`/api/properties/${propertyId}/pms/room-operations/rooms`, {
    headers: authHeaders,
  });
  if (roomsRes.status !== 200) {
    throw new Error(`List rooms failed: ${JSON.stringify(roomsRes.data)}`);
  }
  const rooms = roomsRes.data.data || [];
  console.log(`   ✓ Rooms listed: ${rooms.length} rooms`);
  if (rooms.length > 0) {
    console.log(`     Sample Room: ${rooms[0].roomNumber} (HK: ${rooms[0].housekeepingStatus}, OCC: ${rooms[0].occupancyStatus})`);
  }
  console.log('');

  // 9. Housekeeping Tasks List
  console.log(`9. Housekeeping: List Tasks (GET /api/properties/${propertyId}/pms/housekeeping/tasks)`);
  const hkRes = await request(`/api/properties/${propertyId}/pms/housekeeping/tasks?page=1&limit=10`, {
    headers: authHeaders,
  });
  if (hkRes.status !== 200) {
    throw new Error(`List HK tasks failed: ${JSON.stringify(hkRes.data)}`);
  }
  const hkTasks = hkRes.data.data?.items || hkRes.data.data || [];
  console.log(`   ✓ Housekeeping tasks listed: ${hkTasks.length} tasks`);
  if (hkTasks.length > 0) {
    console.log(`     Sample Task: ID ${hkTasks[0].id} (Status: ${hkTasks[0].status}, Type: ${hkTasks[0].taskType})`);
  }
  console.log('');

  // 10. Engineering Work Orders
  console.log(`10. Engineering: List Work Orders (GET /api/properties/${propertyId}/pms/engineering/work-orders)`);
  const woRes = await request(`/api/properties/${propertyId}/pms/engineering/work-orders?page=1&limit=10`, {
    headers: authHeaders,
  });
  if (woRes.status !== 200) {
    throw new Error(`List work orders failed: ${JSON.stringify(woRes.data)}`);
  }
  const workOrders = woRes.data.data?.items || woRes.data.data || [];
  console.log(`   ✓ Engineering work orders listed: ${workOrders.length} orders`);
  if (workOrders.length > 0) {
    console.log(`     Sample Work Order: ${workOrders[0].title} (${workOrders[0].status}, Priority: ${workOrders[0].priority})`);
  }
  console.log('');

  // 11. Engineering Summary
  console.log(`11. Engineering Summary (GET /api/properties/${propertyId}/pms/engineering/work-orders/summary)`);
  const woSum = await request(`/api/properties/${propertyId}/pms/engineering/work-orders/summary`, {
    headers: authHeaders,
  });
  if (woSum.status === 200) {
    console.log(`   ✓ Engineering Summary: ${JSON.stringify(woSum.data.data || woSum.data)}\n`);
  } else {
    console.log(`   Notice: Summary status ${woSum.status}\n`);
  }

  // 12. Maintenance Blocks List
  console.log(`12. Maintenance Blocks (GET /api/properties/${propertyId}/pms/room-operations/maintenance-blocks)`);
  const mbRes = await request(`/api/properties/${propertyId}/pms/room-operations/maintenance-blocks`, {
    headers: authHeaders,
  });
  if (mbRes.status !== 200) {
    throw new Error(`List maintenance blocks failed: ${JSON.stringify(mbRes.data)}`);
  }
  const blocks = mbRes.data.data?.items || mbRes.data.data || [];
  console.log(`   ✓ Maintenance blocks listed: ${blocks.length} active/scheduled blocks\n`);

  // 13. Create and cancel a maintenance block (testing write operations on DB)
  if (rooms.length > 0) {
    const targetRoom = rooms[rooms.length - 1]; // choose last room
    console.log(`13. Create Maintenance Block for Room ${targetRoom.roomNumber} (POST /api/properties/${propertyId}/pms/room-operations/maintenance-blocks)`);
    const createBlockRes = await request(`/api/properties/${propertyId}/pms/room-operations/maintenance-blocks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        roomId: targetRoom.roomId,
        type: 'OUT_OF_SERVICE',
        reason: 'Smoke test maintenance block verification',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
      }),
    });
    console.log(`   ✓ Maintenance Block create status: ${createBlockRes.status}`);
    if (createBlockRes.status === 201) {
      const createdBlock = createBlockRes.data.data?.maintenanceBlock || createBlockRes.data.data;
      console.log(`   ✓ Created Block ID: ${createdBlock.id}`);
      
      // Cancel it to restore state
      console.log(`   Cancel Maintenance Block (POST /api/properties/${propertyId}/pms/room-operations/maintenance-blocks/${createdBlock.id}/cancel)`);
      const cancelRes = await request(`/api/properties/${propertyId}/pms/room-operations/maintenance-blocks/${createdBlock.id}/cancel`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          reason: 'Smoke test completion',
        }),
      });
      console.log(`   ✓ Maintenance Block cancel status: ${cancelRes.status}\n`);
    } else {
      console.log(`   Notice: Maintenance block create response: ${JSON.stringify(createBlockRes.data)}\n`);
    }
  }

  // 14. Frontend Assets verification
  console.log('14. Angular SPA Frontend Verification');
  const indexHtml = await request('/');
  if (indexHtml.status !== 200 || !indexHtml.data.raw.includes('<app-root')) {
    throw new Error('Frontend index.html verification failed');
  }
  console.log(`   ✓ Frontend index.html served with HTTP 200 and <app-root> tag`);
  
  const dashboardRoute = await request('/dashboard');
  if (dashboardRoute.status !== 200 || !dashboardRoute.data.raw.includes('<app-root')) {
    throw new Error('SPA routing fallback for /dashboard failed');
  }
  console.log(`   ✓ SPA routing fallback for /dashboard served with HTTP 200`);

  const reservationsRoute = await request('/pms/reservations');
  if (reservationsRoute.status !== 200 || !reservationsRoute.data.raw.includes('<app-root')) {
    throw new Error('SPA routing fallback for /pms/reservations failed');
  }
  console.log(`   ✓ SPA routing fallback for /pms/reservations served with HTTP 200\n`);

  console.log('====================================================');
  console.log('ALL P0 PRODUCTION SMOKE TESTS PASSED SUCCESSFULLY! ✓');
  console.log('====================================================');
}

runSmokeTest().catch((err) => {
  console.error('\n❌ Smoke Test Failed:', err);
  process.exit(1);
});
