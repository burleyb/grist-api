/**
 * The test is intended to test the behavior of the library, i.e. translating javascript calls to HTTP
 * requests and interpreting the results. But we can only know it's correct by sending these
 * requests to an actual Grist instance and checking their effects.
 *
 * These tests rely on the "replay" library to record and replay requests. When writing the tests, run
 * them with REPLAY=record environment variables to run against an actual Grist instance. If the
 * tests pass, the HTTP requests and responses get recorded in test/fixtures/replay/. When tests run
 * without this environment variables, the requests get matched, and responses get replayed. When
 * replaying, we are not checking Grist functionality, only that correct requests get produced, and
 * that responses get parsed.
 *
 * To record interactions with REPLAY=record, you need to use a functional instance of Grist on
 * localhost:8080. Upload document test/fixtures/TestGristDocAPI.grist to Grist, and set
 * GRIST_DOC_URL env var to it. Find your API key, and set GRIST_API_KEY env var to it.
 */
// tslint:disable:object-literal-key-quotes

/// <reference types="../replay" />
import axios from 'axios';
import {assert} from 'chai';
import * as chai from 'chai';
import chaiAsPromised = require('chai-as-promised');
import range = require('lodash/range');
import * as path from 'path';
import * as Replay from 'replay';
import {
  CellValue, GristDocAPI, IRecord, IGristCallConfig,
  FetchTableOptions, AddRecordsOptions, DeleteRecordsOptions,
  UpdateRecordsOptions, SyncTableOptions
} from '../../lib';

chai.use(chaiAsPromised);

// Set where Replay will record requests, with REPLAY=record env var.
Replay.fixtures = path.join(path.dirname(__dirname), '/fixtures/replay');

// Remove "localhost" from Replay's list of localhosts requests to which it would not record.
Replay.reset('localhost');

// Do not record the Authorization header.
Replay.headers  = (Replay.headers as RegExp[]).filter((r) => !/auth/i.test(r.source));

// Server and docId with which fixtures were recorded.
const GRIST_URL = process.env.GRIST_URL || "http://localhost:8080";
const DOC_ID = process.env.GRIST_DOC_ID || "28a446f2-903e-4bd4-8001-1dbd3a68e5a5";
const LIVE = Boolean(process.env.REPLAY && process.env.REPLAY !== 'replay');

const initialData: {[tableId: string]: CellValue[][]} = {
  Table1: [
    ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value', 'ChoiceList'],
    [1,     'Apple',      5,      datets(2019, 6, 26),  1,          "RED",            ['L', 'Foo', 'Bar']],
    [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE",         ['L', 'Baz 2']],
    [3,     'Melon',      12,     datets(2019, 4, 2),   3,          "GREEN",          null],
    [4,     'Strawberry', 1.5,    datets(2019, 3, 3),   1,          "RED",            ['L', 'Baz 2', 'Foo']],
  ],
};

function assertData(records: IRecord[], expectedWithHeaders: CellValue[][]) {
  const headers = expectedWithHeaders[0] as string[];
  const expected = expectedWithHeaders.slice(1);
  const actual = records.map((r) => headers.map((h) => r[h]));
  assert.deepEqual(actual, expected);
}

function datets(year: number, month1based: number, day: number): number {
  return Date.UTC(year, month1based - 1, day) / 1000;
}

describe("grist-api", function() {
  this.timeout(10000);

  let gristApi: GristDocAPI;
  let interceptor: number;
  let requestNum: number = 0;

  before(function() {
    gristApi = new GristDocAPI({server:GRIST_URL, apiKey: LIVE ? undefined : "unused"});
    gristApi.setDocId(DOC_ID);
  });

  beforeEach(async function() {
    // Include a per-test sequential value into each request, so that the replay module doesn't
    // reuse requests (e.g. fetchTable calls produce different results after changes to doc).
    const testName = this.currentTest!.fullTitle();
    requestNum = 0;
    interceptor = axios.interceptors.request.use((config) => {
      config.headers['X-Request-Num'] = `${testName}/${requestNum++}`;
      return config;
    });
  });

  afterEach(async function() {
    axios.interceptors.request.eject(interceptor);
  });

  it("should parse various doc URLs", async function() {
    function getDocId(docUrlOrId: string) {
      return new GristDocAPI({server:GRIST_URL, apiKey: "unused"}).docId;
    }
    assert.equal(getDocId('http://localhost:8080/o/docs/wW5ATuoLAKwH/Receivable/p/1'), 'wW5ATuoLAKwH');
    assert.equal(getDocId('https://public.getgrist.com/doc/foobar/p/19'), 'foobar');
    assert.equal(getDocId('https://gristlabs.getgrist.com/8p81LjiWSEDT/ACME-Tacos-Projects'), '8p81LjiWSEDT');
    assert.equal(getDocId('https://gristlabs.getgrist.com/doc/8p81LjiWSEDT1K1oV9NEX9'), '8p81LjiWSEDT1K1oV9NEX9');
  });

  it("should support fetchTable", async function() {
    // Test the basic fetchTable
    const fetchOptions1: FetchTableOptions = {tableName: 'Table1'};
    let data: IRecord[] = await gristApi.fetchTable(fetchOptions1);
    assertData(data, initialData.Table1);

    // Test fetchTable with filters
    const fetchOptions2: FetchTableOptions = {tableName: 'Table1', filters: {ColorRef: [1]}};
    data = await gristApi.fetchTable(fetchOptions2);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value', 'ChoiceList'],
      [1,     'Apple',      5,      datets(2019, 6, 26),  1,          "RED",            ['L', 'Foo', 'Bar']],
      [4,     'Strawberry', 1.5,    datets(2019, 3, 3),   1,          "RED",            ['L', 'Baz 2', 'Foo']],
    ]);
  });

  it("should support addRecords and deleteRecords", async function() {
    const addOptions: AddRecordsOptions = {tableName: 'Table1', records: [
      {Text_Field: "Eggs", Num: 2, ColorRef: 3, Date: datets(2019, 1, 17)},
      {Text_Field: "Beets", Num: 2}
    ]};
    const addedRows = await gristApi.addRecords(addOptions);
    assert.deepEqual(addedRows, [5, 6]);

    const fetchOptions: FetchTableOptions = {tableName: 'Table1', filters: {Num: [2]}};
    let data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value'],
      [5,     'Eggs',       2,      datets(2019, 1, 17),  3,          "GREEN"],
      [6,     'Beets',      2,      null,                 0,          null],
    ]);

    const deleteOptions: DeleteRecordsOptions = {tableName: 'Table1', recordIds: [5, 6]};
    await gristApi.deleteRecords(deleteOptions);

    data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value'],
    ]);
  });

  it('should support updateRecords', async function() {
    const updateOptions1: UpdateRecordsOptions = {tableName: 'Table1', records: [
      {"id": 1, "Num": -5, "Text_Field": "snapple", "ColorRef": 2},
      {"id": 4, "Num": -1.5, "Text_Field": null, "ColorRef": 2},
    ]};
    await gristApi.updateRecords(updateOptions1);

    // Note that the formula field gets updated too.
    const fetchOptions: FetchTableOptions = {tableName: 'Table1'};
    let data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value'],
      [1,     'snapple',    -5,     datets(2019, 6, 26),  2,          "ORANGE"],
      [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE"],
      [3,     'Melon',      12,     datets(2019, 4, 2),   3,          "GREEN"],
      [4,     null,         -1.5,   datets(2019, 3, 3),   2,          "ORANGE"],
    ]);

    // Revert the changes.
    const updateOptions2: UpdateRecordsOptions = {tableName: 'Table1', records: [
      {"id": 1, "Num": 5, "Text_Field": "Apple", "ColorRef": 1},
      {"id": 4, "Num": 1.5, "Text_Field": "Strawberry", "ColorRef": 1},
    ]};
    await gristApi.updateRecords(updateOptions2);
    data = await gristApi.fetchTable(fetchOptions);
    assertData(data, initialData.Table1);
  });

  it('should support varied updateRecords', async function() {
    // Mismatched column sets work too.
    const updateOptions1: UpdateRecordsOptions = {tableName: 'Table1', records: [
      {"id": 1, "Num": -5, "Text_Field": "snapple"},
      {"id": 4, "Num": -1.5, "ColorRef": 2, "ChoiceList": ['L', 'Bar']},
    ]};
    await gristApi.updateRecords(updateOptions1);

    const fetchOptions: FetchTableOptions = {tableName: 'Table1'};
    let data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value', 'ChoiceList'],
      [1,     'snapple',    -5,     datets(2019, 6, 26),  1,          "RED",            ['L', 'Foo', 'Bar']],
      [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE",         ['L', 'Baz 2']],
      [3,     'Melon',      12,     datets(2019, 4, 2),   3,          "GREEN",          null],
      [4,     'Strawberry', -1.5,   datets(2019, 3, 3),   2,          "ORANGE",         ['L', 'Bar']],
    ]);

    // Revert the changes.
    const updateOptions2: UpdateRecordsOptions = {tableName: 'Table1', records: [
      {"id": 1, "Num": 5, "Text_Field": "Apple"},
      {"id": 4, "Num": 1.5, "ColorRef": 1, "ChoiceList": ['L', 'Baz 2', 'Foo']},
    ]};
    await gristApi.updateRecords(updateOptions2);

    data = await gristApi.fetchTable(fetchOptions);
    assertData(data, initialData.Table1);
  });

  it('should support syncTable', async function() {
    const syncOptions1: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Apple', Num: 17, Date: datets(2020, 5, 1)},
      {Text_Field: 'Banana', Num: 33, Date: datets(2020, 5, 2)},
      {Text_Field: 'Melon', Num: 28, Date: null},
    ], keyColIds: ['Text_Field']};
    await gristApi.syncTable(syncOptions1);

    const fetchOptions: FetchTableOptions = {tableName: 'Table1'};
    let data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value', 'ChoiceList'],
      [1,     'Apple',      17,     datets(2020, 5, 1),   1,          "RED",            ['L', 'Foo', 'Bar']],
      [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE",         ['L', 'Baz 2']],
      [3,     'Melon',      28,     null,                 3,          "GREEN",          null],
      [4,     'Strawberry', 1.5,    datets(2019, 3, 3),   1,          "RED",            ['L', 'Baz 2', 'Foo']],
      [5,     'Banana',     33,     datets(2020, 5, 2),   0,          null,             null],
    ]);

    const syncOptions2: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Apple',       ChoiceList: ['L', 'Foo', 'Bar']},
      {Text_Field: 'Strawberry',  ChoiceList: ['L', 'Baz 2']},
    ], keyColIds: ['Text_Field']};
    await gristApi.syncTable(syncOptions2);

    data = await gristApi.fetchTable(fetchOptions);
    assertData(data, [
      ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value', 'ChoiceList'],
      [1,     'Apple',      17,     datets(2020, 5, 1),   1,          "RED",            ['L', 'Foo', 'Bar']],
      [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE",         ['L', 'Baz 2']],
      [3,     'Melon',      28,     null,                 3,          "GREEN",          null],
      [4,     'Strawberry', 1.5,    datets(2019, 3, 3),   1,          "RED",            ['L', 'Baz 2']],
      [5,     'Banana',     33,     datets(2020, 5, 2),   0,          null,             null],
    ]);

    // Revert data, and delete the newly-added record.
    const syncOptions3: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Apple', Num: 5, Date: datets(2019, 6, 26)},
      {Text_Field: 'Melon', Num: 12, Date: datets(2019, 4, 2)},
      {Text_Field: 'Strawberry', ChoiceList: ['L', 'Baz 2', 'Foo']},
    ], keyColIds: ['Text_Field']};
    await gristApi.syncTable(syncOptions3);
    const deleteOptions: DeleteRecordsOptions = {tableName: 'Table1', recordIds: [5]};
    await gristApi.deleteRecords(deleteOptions);

    // Check we are back to where we started.
    data = await gristApi.fetchTable(fetchOptions);
    assertData(data, initialData.Table1);
  });

  it('should support syncTable with filters', async function() {
    // syncTable should check that filters are a subset of key columns.
    const syncOptions1: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Melon', Num: 100, Date: datets(2020, 6, 1)},
      {Text_Field: 'Strawberry', Num: 200, Date: datets(2020, 6, 2)},
    ], keyColIds: ['Text_Field'], filters: {"ColorRef": [1]}};
    await assert.isRejected(
      gristApi.syncTable(syncOptions1),
      /key columns.*filter columns/);

    // If columns don't match the filter, the records are ignored.
    const syncOptions2: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Melon', Num: 100, Date: datets(2020, 6, 1)},
      {Text_Field: 'Strawberry', Num: 200, Date: datets(2020, 6, 2)},
      {Text_Field: 'Melon', Num: 100, Date: datets(2020, 6, 1), ColorRef: 3},
      {Text_Field: 'Strawberry', Num: 200, Date: datets(2020, 6, 2), ColorRef: 3},
    ], keyColIds: ['Text_Field', 'ColorRef'], filters: {"ColorRef": [1]}};
    await gristApi.syncTable(syncOptions2);

    // Nothing changed because the first call was rejected, and in the second, the pass-in records
    // didn't match the filter.
    const fetchOptions1: FetchTableOptions = {tableName: 'Table1'};
    let data = await gristApi.fetchTable(fetchOptions1);
    assertData(data, initialData.Table1);

    async function sync() {
      // Try again with the matching filter column included.
      const syncOptions3: SyncTableOptions = {tableName: 'Table1', records: [
        {Text_Field: 'Melon', Num: 100, Date: datets(2020, 6, 1), ColorRef: 1},
        {Text_Field: 'Strawberry', Num: 200, Date: datets(2020, 6, 2), ColorRef: 1},
      ], keyColIds: ['Text_Field', 'ColorRef'], filters: {"ColorRef": [1]}};
      await gristApi.syncTable(syncOptions3);

      // Note that Melon got added because it didn't exist in the filtered view.
      data = await gristApi.fetchTable(fetchOptions1);
      assertData(data, [
        ['id',  'Text_Field', 'Num',  'Date',               'ColorRef', 'ColorRef_Value'],
        [1,     'Apple',      5,      datets(2019, 6, 26),  1,          "RED"],
        [2,     'Orange',     8,      datets(2019, 5, 1),   2,          "ORANGE"],
        [3,     'Melon',      12,     datets(2019, 4, 2),   3,          "GREEN"],
        [4,     'Strawberry', 200,    datets(2020, 6, 2),   1,          "RED"],
        [5,     'Melon',      100,    datets(2020, 6, 1),   1,          "RED"],
      ]);
    }

    // Run this twice, to test the call AND ensure it's itempotent.
    await sync();
    await sync();

    // Revert data, and delete the newly-added record.
    const syncOptions4: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Strawberry', Num: 1.5, Date: datets(2019, 3, 3), ColorRef: 1},
    ], keyColIds: ['Text_Field', 'ColorRef'], filters: {"ColorRef": [1]}};
    await gristApi.syncTable(syncOptions4);
    const deleteOptions: DeleteRecordsOptions = {tableName: 'Table1', recordIds: [5]};
    await gristApi.deleteRecords(deleteOptions);

    // Check we are back to where we started.
    data = await gristApi.fetchTable(fetchOptions1);
    assertData(data, initialData.Table1);
  });

  it('should support chunking', async function() {
    // Using chunk_size should produce 5 requests (4 of 12 records, and 1 of 2). We can tell that
    // by examining the recorded fixture in "test/fixtures/replay/test_chunking", and we test by
    // using the requestNum variable, incremented for each request by axios interceptor.
    const myRange = range(50);
    let startRequestNum: number;

    // tslint:disable-next-line:no-shadowed-variable
    const gristApi = new GristDocAPI({apiKey: LIVE ? undefined : "unused", chunkSize: 12, server: GRIST_URL});
    gristApi.setDocId(DOC_ID);

    startRequestNum = requestNum;
    const addOptions: AddRecordsOptions = {
      tableName: 'Table1', records: myRange.map((n) => ({Text_Field: "Chunk", Num: n}))};
    const rowNums = await gristApi.addRecords(addOptions);
    assert.deepEqual(rowNums, myRange.map((n) => 5 + n));
    assert.equal(requestNum - startRequestNum, 5);

    // Verify data is correct.
    const fetchOptions1: FetchTableOptions = {tableName: 'Table1'};
    let data = await gristApi.fetchTable(fetchOptions1);
    assertData(data, [
      ...initialData.Table1,
      ...myRange.map((n) => [5 + n, 'Chunk', n, null, 0, null, null])
    ]);

    // Update data using chunking.
    startRequestNum = requestNum;
    const updateOptions: UpdateRecordsOptions = {tableName: 'Table1',
      records: myRange.map((n) => ({id: 5 + n, Text_Field: "Peanut Butter", ColorRef: 2}))};
    await gristApi.updateRecords(updateOptions);
    assert.equal(requestNum - startRequestNum, 5);

    data = await gristApi.fetchTable(fetchOptions1);
    assertData(data, [
      ...initialData.Table1,
      ...myRange.map((n) => [5 + n, 'Peanut Butter', n, null, 2, 'ORANGE', null])
    ]);

    // Delete data using chunking.
    startRequestNum = requestNum;
    const deleteOptions: DeleteRecordsOptions = {tableName: 'Table1', recordIds: myRange.map((n) => 5 + n)};
    await gristApi.deleteRecords(deleteOptions);
    assert.equal(requestNum - startRequestNum, 5);
    data = await gristApi.fetchTable(fetchOptions1);
    assertData(data, initialData.Table1);
  });

  it('should produce helpful errors', async function() {
    const fetchOptions1: FetchTableOptions = {tableName: 'Unicorn'};
    await assert.isRejected(gristApi.fetchTable(fetchOptions1), /Table not found.*Unicorn/);
    const fetchOptions2: FetchTableOptions = {tableName: 'Table1', filters: {"ColorRef": [1], "ColorBoom": [2]}};
    await assert.isRejected(gristApi.fetchTable(fetchOptions2), /ColorBoom/);
    const addOptions: AddRecordsOptions = {tableName: 'Table1', records: [{"Text_Field": "Beets", "NumX": 2}]};
    await assert.isRejected(gristApi.addRecords(addOptions),
      /Invalid column.*NumX/);
  });

  function withUnsetApiKey(testCase: () => Promise<void>) {
    // Ignore GRIST_API_KEY in the actual environment, and don't use the real HOME, so that the
    // test doesn't depend on whether there is a ~/.grist-api-key file for the user running the
    // test. These tests assume a blank slate for API key settings.
    const origHome = process.env.HOME;
    const origEnvVar = process.env.GRIST_API_KEY;
    return async () => {
      process.env.HOME = '/tmp/grist-api-nonexistent';
      delete process.env.GRIST_API_KEY;
      try {
        return await testCase();
      } finally {
        process.env.HOME = origHome;
        if (origEnvVar !== undefined) {
          process.env.GRIST_API_KEY = origEnvVar;
        }
      }
    };
  }

  it('should show helpful errors when API key is not set', withUnsetApiKey(async function() {
    let api = new GristDocAPI();
    api.setDocId(DOC_ID);
    // Key wasn't explicitly given, but apparently was needed, so check that some info about that
    // gets mentioned.
    const fetchOptions1: FetchTableOptions = {tableName: 'Table1'};
    await assert.isRejected(api.fetchTable(fetchOptions1),
      /No view access.*API key not given.*GRIST_API_KEY env.*\\.grist-api-key/);

    api = new GristDocAPI({apiKey: ''});
    api.setDocId(DOC_ID);
    // Key was explicitly given as empty, so nothing to add about it.
    const fetchOptions2: FetchTableOptions = {tableName: 'Table1'};
    await assert.isRejected(api.fetchTable(fetchOptions2),
      /No view access$/);

    const origEnvVar = process.env.GRIST_API_KEY;
    try {
      process.env.GRIST_API_KEY = '';
      // Key was explicitly given as empty via env var, so nothing to add about it.
      api = new GristDocAPI();
      api.setDocId(DOC_ID);
      const fetchOptions3: FetchTableOptions = {tableName: 'Table1'};
      await assert.isRejected(api.fetchTable(fetchOptions3),
        /No view access$/);
    } finally {
      process.env.GRIST_API_KEY = origEnvVar;
    }

    api = new GristDocAPI({apiKey: 'invalid'});
    api.setDocId(DOC_ID);
    // Key was explicitly given, so nothing to add about it.
    const fetchOptions4: FetchTableOptions = {tableName: 'Table1'};
    await assert.isRejected(api.fetchTable(fetchOptions4),
      /invalid API key/);
  }));

  it('should allow access to public docs without API key', withUnsetApiKey(async function() {
    const publicDocUrl = 'https://templates.getgrist.com/doc/lightweight-crm';
    let api = new GristDocAPI();
    api.setDocId(publicDocUrl);
    const fetchOptions1: FetchTableOptions = {tableName: 'Contacts'};
    assert.isAbove((await api.fetchTable(fetchOptions1)).length, 5);

    // We can also explicitly specify an empty api key.
    api = new GristDocAPI({apiKey: ''});
    api.setDocId(publicDocUrl);
    const fetchOptions2: FetchTableOptions = {tableName: 'Contacts'};
    assert.isAbove((await api.fetchTable(fetchOptions2)).length, 5);

    // But explicitly specifying an invalid key will fail, as it should.
    api = new GristDocAPI({apiKey: 'invalid'});
    api.setDocId(publicDocUrl);
    const fetchOptions3: FetchTableOptions = {tableName: 'Contacts'};
    await assert.isRejected(api.fetchTable(fetchOptions3), /invalid API key/);
  }));

  it('should handle empty record arrays', async function() {
    // Test addRecords with empty array
    const addOptionsEmpty: AddRecordsOptions = {tableName: 'Table1', records: []};
    const addedRowsEmpty = await gristApi.addRecords(addOptionsEmpty);
    assert.deepEqual(addedRowsEmpty, [], "addRecords with empty array should return empty array");

    // Test updateRecords with empty array
    const updateOptionsEmpty: UpdateRecordsOptions = {tableName: 'Table1', records: []};
    await assert.isFulfilled(
      gristApi.updateRecords(updateOptionsEmpty),
      "updateRecords with empty array should not reject"
    );

    // Test deleteRecords with empty array
    const deleteOptionsEmpty: DeleteRecordsOptions = {tableName: 'Table1', recordIds: []};
    await assert.isFulfilled(
      gristApi.deleteRecords(deleteOptionsEmpty),
      "deleteRecords with empty array should not reject"
    );

    // Test syncTable with empty array
    const syncOptionsEmpty: SyncTableOptions = {tableName: 'Table1', records: [], keyColIds: ['Text_Field']};
    const syncResult = await gristApi.syncTable(syncOptionsEmpty);
    assert.deepEqual(syncResult, {numAdded: 0, numUpdated: 0}, "syncTable with empty array should result in zero changes");
  });

  it('should handle syncTable without filters', async function() {
    // Sync should work without providing the optional filters parameter
    const syncOptions: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Orange', Num: 99}
    ], keyColIds: ['Text_Field']};
    await assert.isFulfilled(
      gristApi.syncTable(syncOptions),
      "syncTable without filters should not reject"
    );
    // Check if the record was updated
    const fetchOptions: FetchTableOptions = {tableName: 'Table1', filters: {Text_Field: ['Orange']}};
    const data = await gristApi.fetchTable(fetchOptions);
    assert.equal(data[0].Num, 99, "syncTable should update record without filters");

    // Revert change
    const revertSyncOptions: SyncTableOptions = {tableName: 'Table1', records: [
      {Text_Field: 'Orange', Num: 8}
    ], keyColIds: ['Text_Field']};
    await gristApi.syncTable(revertSyncOptions);
    const revertedData = await gristApi.fetchTable(fetchOptions);
    assert.equal(revertedData[0].Num, 8, "syncTable should revert record");
  });

  it('should handle non-existent record IDs in deleteRecords', async function() {
    const deleteOptions: DeleteRecordsOptions = {tableName: 'Table1', recordIds: [999, 1000]};
    // Deleting non-existent records should not throw an error
    await assert.isFulfilled(
      gristApi.deleteRecords(deleteOptions),
      "deleteRecords with non-existent IDs should not reject"
    );
  });

  it('should require id field for updateRecords', async function() {
    const updateOptions: UpdateRecordsOptions = {tableName: 'Table1', records: [
      {Text_Field: "MissingID", Num: 100}
    ]};
    await assert.isRejected(
      gristApi.updateRecords(updateOptions),
      /updateRecord requires numeric 'id' attribute in each record/,
      "updateRecords should reject if 'id' field is missing"
    );
  });

  // Note: Chunking edge cases (e.g., chunk size 1, chunk size > num records) are implicitly tested
  // by the existing 'should support chunking' test if it uses different chunk sizes and record counts.
  // Adding specific tests for these might be redundant unless the chunking logic is complex.

  it('should produce helpful errors', async function() {
    const fetchOptions1: FetchTableOptions = {tableName: 'Unicorn'};
    await assert.isRejected(gristApi.fetchTable(fetchOptions1), /Table not found.*Unicorn/);
  });
});
