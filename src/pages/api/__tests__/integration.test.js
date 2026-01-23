/**
 * Integration tests using real YouTube API
 * 
 * Run with: npm run test:integration
 * 
 * These tests hit the actual YouTube API and verify the full flow.
 * They should be run periodically to catch YouTube API changes.
 */

import { createMocks } from 'node-mocks-http';
import testDataset from './test-dataset.json';

// Only run integration tests when explicitly enabled
const INTEGRATION_ENABLED = process.env.INTEGRATION_TEST === 'true';

// Skip all tests if not enabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

describeIntegration('Integration Tests - Real YouTube API', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  const API_KEY = process.env.YOUTUBE_API_KEY || 'test-local-api-key-123';

  describeIntegration('Video Details API', () => {
    let handler;

    beforeAll(async () => {
      // Dynamic import to ensure fresh module
      const module = await import('../video-details.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['video-details'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id, transcript: testCase.transcript?.expected ?? false },
        });

        await handler(req, res);

        // Basic success check
        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());

        // Verify expected fields exist
        testCase.expectedFields?.forEach(field => {
          expect(data).toHaveProperty(field);
        });

        // Verify video ID matches
        expect(data.id).toBe(testCase.id);

        // Verify title is not empty
        expect(data.title).toBeTruthy();

        // Check transcript if expected
        if (testCase.transcript?.expected) {
          expect(data.transcript_status?.available).toBe(true);
          expect(data.transcript).toBeTruthy();
        }

        // Check live content flag
        if (testCase.isLive) {
          expect(data.isLiveContent).toBe(true);
        }

        // Check chapters if expected
        if (testCase.type === 'chapters') {
          expect(Array.isArray(data.chapters)).toBe(true);
        }

        console.log(`✅ ${testCase.name}: ${data.title}`);
      }
    );

    test.each(testDataset.testCases['error-handling'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id, transcript: false },
        });

        await handler(req, res);

        // Should return expected error code
        expect(res._getStatusCode()).toBe(testCase.expectedError);
        console.log(`✅ ${testCase.name}: Got expected ${testCase.expectedError} error`);
      }
    );
  });

  describeIntegration('Transcript API', () => {
    let handler;

    beforeAll(async () => {
      const module = await import('../transcript.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['transcript-only'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());
        expect(data.data).toBeTruthy();
        expect(data.data.length).toBeGreaterThan(100);

        console.log(`✅ ${testCase.name}: Got ${data.data.length} chars`);
      }
    );
  });

  describeIntegration('Live Content', () => {
    let handler;

    beforeAll(async () => {
      const module = await import('../video-details.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['live-content'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id, transcript: true },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());
        
        // Live streams should be marked as live
        expect(data.isLiveContent).toBe(true);

        // Transcript should not be available for live content
        if (testCase.transcript?.expected === false) {
          expect(data.transcript_status?.available).toBe(false);
        }

        console.log(`✅ ${testCase.name}: Live=${data.isLiveContent}`);
      }
    );
  });

  describeIntegration('Search API', () => {
    let handler;

    beforeAll(async () => {
      const module = await import('../search.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['search'])(
      'Search $type for "$query"',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { query: testCase.query, type: testCase.type, page: 1 },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThanOrEqual(testCase.minResults);

        console.log(`✅ Search ${testCase.type} "${testCase.query}": ${data.length} results`);
      }
    );
  });

  describeIntegration('Channel Details API', () => {
    let handler;

    beforeAll(async () => {
      const module = await import('../channel-details.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['channel-details'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());

        testCase.expectedFields?.forEach(field => {
          expect(data).toHaveProperty(field);
        });

        expect(data.name).toBeTruthy();

        console.log(`✅ ${testCase.name}: ${data.name}`);
      }
    );
  });

  describeIntegration('Playlist API', () => {
    let handler;

    beforeAll(async () => {
      const module = await import('../playlist.js');
      handler = module.default;
    });

    test.each(testDataset.testCases['playlist'])(
      '$name (id: $id)',
      async (testCase) => {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'api-key': API_KEY },
          body: { id: testCase.id, page: 1 },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);

        const data = JSON.parse(res._getData());
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThanOrEqual(testCase.minVideos);

        console.log(`✅ ${testCase.name}: ${data.length} videos`);
      }
    );
  });
});

// Quick smoke test that always runs
describe('Smoke Test - API Structure', () => {
  test('test dataset is valid', () => {
    expect(testDataset).toHaveProperty('testCases');
    expect(testDataset.testCases).toHaveProperty('video-details');
    expect(testDataset.testCases['video-details'].length).toBeGreaterThan(0);
  });
});
