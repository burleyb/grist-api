/**
 * Client-side library to interact with Grist.
 */
import axios, { Method, AxiosError, AxiosRequestConfig, ResponseType } from 'axios';
import chunk = require('lodash/chunk');
import isEqual = require('lodash/isEqual');
import mapValues = require('lodash/mapValues');
import pick = require('lodash/pick');

// Require type only, since the actual require may not be needed or available,
// depending on how and where grist-api is used.
import type * as FsExtra from 'fs-extra';

// Import debug with any type to avoid type issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any

// Type for values in Grist data cells.
export type CellValue = number|string|boolean|null|[string, ...any[]];

// Record representing a row in a Grist table.
export interface IRecord { [colId: string]: CellValue; }

// GristTableSchema interfaces to match the provided JSON structure
export interface IColumnField {
  label: string;
  [key: string]: any;
}

export interface IColumn {
  id: string;
  fields: IColumnField;
}

export interface ITable {
  id: string;
  columns: IColumn[];
}

export interface ITableSchema {
  tables: ITable[];
}

// Type used by Grist for table data in its API calls, mapping column name to list of values.
export interface ITableData { [colId: string]: CellValue[]; }

// Maps colIds to set of values to include when filtering.
export interface IFilterSpec { [colId: string]: CellValue[]; }

// Access level types
export type AccessLevel = 'owners' | 'editors' | 'viewers' | 'members' | null;

// Organization interface
export interface IOrg {
  id: number;
  name: string;
  domain: string;
}

// Workspace interface
export interface IWorkspace {
  id: number;
  name: string;
  docs?: IDoc[];
}

// Document interface
export interface IDoc {
  id: string;
  name: string;
  workspace?: IWorkspace;
}

// Access interfaces
export interface IUserAccess {
  id: number;
  name: string;
  email?: string;
  access: AccessLevel;
}

export interface IAccessDelta {
  users: { [email: string]: AccessLevel };
}

export interface IWorkspaceAccess extends IUserAccess {
  parentAccess?: AccessLevel;
}

export interface IWorkspaceAccessRead {
  maxInheritedRole: AccessLevel;
  users: IWorkspaceAccess[];
}

export interface IWorkspaceAccessWrite {
  maxInheritedRole?: AccessLevel;
  users: { [email: string]: AccessLevel };
}

export interface IDocParameters {
  name?: string;
}

export interface IWorkspaceParameters {
  name?: string;
}

export interface IOrgParameters {
  name?: string;
}

// General config for API client
export interface IGristCallConfig {
  apiKey?: string;
  server?: string;
  dryrun?: boolean;
  chunkSize?: number;
}

// Options interfaces for specific method calls
export interface ListWorkspacesOptions {
  orgId?: number | string;
}

export interface CreateWorkspaceOptions extends IWorkspaceParameters {
  orgId?: number | string;
}

export interface GetWorkspaceByNameOptions {
  name: string;
  orgId?: number | string;
}

export interface GetOrgOptions {
  orgId: number | string;
}

export interface GetOrgByNameOptions {
  name: string;
}

export interface GetOrgByDomainOptions {
  domain: string;
}


export interface ModifyOrgOptions extends IOrgParameters {
  orgId: number | string;
}

export interface DeleteOrgOptions {
  orgId: number | string;
}

export interface GetOrgAccessOptions {
  orgId: number | string;
}

export interface ModifyOrgAccessOptions {
  orgId: number | string;
  delta: IAccessDelta;
}

export interface GetWorkspaceOptions {
  workspaceId: number;
}

export interface ModifyWorkspaceOptions extends IWorkspaceParameters {
  workspaceId: number;
}

export interface DeleteWorkspaceOptions {
  workspaceId: number;
}

export interface GetWorkspaceAccessOptions {
  workspaceId: number;
}

export interface ModifyWorkspaceAccessOptions {
  workspaceId: number;
  delta: IWorkspaceAccessWrite;
}

export interface CreateDocOptions extends IDocParameters {
  workspaceId: number;
}

export interface GetDocOptions {
  docId?: string;
}

export interface GetDocByNameOptions {
  name: string;
  workspaceId: number;
}

export interface ModifyDocOptions extends IDocParameters {
  docId?: string;
}

export interface DeleteDocOptions {
  docId?: string;
}

export interface MoveDocOptions {
  workspaceId: number;
  docId?: string;
}

export interface GetDocAccessOptions {
  docId?: string;
}

export interface ModifyDocAccessOptions {
  delta: IWorkspaceAccessWrite;
  docId?: string;
}

export interface DownloadDocOptions {
  nohistory?: boolean;
  template?: boolean;
  docId?: string;
}

export interface CreateTableOptions {
  docId?: string;
  schema: ITableSchema;
}

export interface ListTablesOptions {
  docId?: string;
}

export interface GetTableOptions {
  tableId?: string;
  docId?: string;
}

export interface GetTableByIdOptions {
  tableId?: string;
  docId?: string;
}

export interface GetTableByNameOptions {
  name?: string;
  docId?: string;
}

export interface FetchTableOptions {
  tableName: string;
  filters?: IFilterSpec;
  docId?: string;
}

export interface AddRecordsOptions {
  tableName: string;
  records: IRecord[];
  docId?: string;
}

export interface DeleteRecordsOptions {
  tableName: string;
  recordIds: number[];
  docId?: string;
}

export interface UpdateRecordsOptions {
  tableName: string;
  records: IRecord[];
  docId?: string;
}

export interface SyncTableOptions {
  tableName: string;
  records: IRecord[];
  keyColIds: string[];
  filters?: IFilterSpec;
  docId?: string;
}

export interface AttachOptions {
  files: File[];
  docId?: string;
}

export async function getAPIKey(): Promise<string> {
  if (typeof process === 'undefined') {
    throw new Error('In browser environment, Grist API key must be provided');
  }

  // Otherwise, assume we are in node environment.
  if (process.env.GRIST_API_KEY !== undefined) {
    return process.env.GRIST_API_KEY;
  }
  const os = require('os');
  const path = require('path');
  const fse: typeof FsExtra = require('fs-extra');
  const keyPath = path.join(os.homedir(), ".grist-api-key");
  if (await fse.pathExists(keyPath)) {
    return (await fse.readFile(keyPath, {encoding: 'utf8'})).trim();
  }
  throw new Error(`Grist API key not given, or found in GRIST_API_KEY env, or in ${keyPath}`);
}

/**
 * Class for interacting with Grist API.
 */
export class GristDocAPI {
  private _dryrun: boolean;
  private _docId: string | null;
  private _server: string;
  private _apiKey: string | null;
  private _chunkSize: number;
  private _orgId: number | string | null;

  constructor(options: IGristCallConfig = {}) {
    this._dryrun = Boolean(options.dryrun);
    this._server = options.server || 'https://api.getgrist.com';
    this._apiKey = options.apiKey ?? null;
    this._chunkSize = options.chunkSize || 500;
    this._docId = null;
    this._orgId = null;
  }

  /**
   * Sets the organization context for organization-specific operations.
   */
  public setOrgId(orgId: number | string): void {
    this._orgId = orgId;
  }

  /**
   * Set the document context for document-specific operations.
   * You may specify either a doc URL, or just the doc ID (the part of the URL after "/doc/").
   * If you specify a URL, then the server from the URL will be used.
   */
  public setDocId(docUrlOrId: string): void {
    const match = /^(https?:\/\/[^\/]+(?:\/o\/[^\/]+)?)\/(?:doc\/([^\/?#]+)|([^\/?#]{12,}))/.exec(docUrlOrId);
    if (match) {
      this._server = match[1];
      this._docId = match[2] || match[3];
    } else {
      this._docId = docUrlOrId;
    }
  }

  /**
   * Resolves the orgId to use, prioritizing passed parameter over class context.
   * Throws if neither is available.
   */
  private _resolveOrgId(orgId?: number | string): number | string {
    const idToUse = orgId ?? this._orgId;
    if (!idToUse) {
      throw new Error('No organization context set or provided. Call setOrgId() or pass orgId in options.');
    }
    return idToUse;
  }

  /**
   * Resolves the docId to use, prioritizing passed parameter over class context.
   * Throws if neither is available.
   */
  private _resolveDocId(docId?: string): string {
    const idToUse = docId ?? this._docId;
    if (!idToUse) {
      throw new Error('No document context set or provided. Call setDocId() or pass docId in options.');
    }
    return idToUse;
  }

  public get docId(): string | null { return this._docId; }
  public get orgId(): number | string | null { return this._orgId; }

  // Organization endpoints using options object
  public async listOrgs(): Promise<IOrg[]> {
    return await this._call('orgs');
  }

  public async getOrg(options: GetOrgOptions): Promise<IOrg> {
    const { orgId } = options;
    return await this._call(`orgs/${orgId}`);
  }

  public async getOrgByName(options: GetOrgByNameOptions): Promise<IOrg | undefined> {
    const { name } = options;
    const orgs = await this.listOrgs();
    return orgs.find((org: IOrg) => org.name === name);
  }

  public async getOrgByDomain(options: GetOrgByDomainOptions): Promise<IOrg | undefined> {
    const { domain } = options;
    const orgs = await this.listOrgs();
    return orgs.find((org: IOrg) => org.domain === domain);
  }

  public async modifyOrg(options: ModifyOrgOptions): Promise<void> {
    const { orgId, ...params } = options;
    await this._call(`orgs/${orgId}`, params, 'PATCH');
  }

  public async deleteOrg(options: DeleteOrgOptions): Promise<void> {
    const { orgId } = options;
    await this._call(`orgs/${orgId}`, undefined, 'DELETE');
  }

  public async getOrgAccess(options: GetOrgAccessOptions): Promise<IUserAccess[]> {
    const { orgId } = options;
    return await this._call(`orgs/${orgId}/access`);
  }

  public async modifyOrgAccess(options: ModifyOrgAccessOptions): Promise<void> {
    const { orgId, delta } = options;
    await this._call(`orgs/${orgId}/access`, { delta }, 'PATCH');
  }

  // Workspace endpoints using options object
  public async listWorkspaces(options: ListWorkspacesOptions = {}): Promise<IWorkspace[]> {
    const { orgId } = options;
    const resolvedOrgId = this._resolveOrgId(orgId);
    return await this._call(`orgs/${resolvedOrgId}/workspaces`);
  }

  public async createWorkspace(options: CreateWorkspaceOptions): Promise<number> {
    const { orgId, ...params } = options;
    const resolvedOrgId = this._resolveOrgId(orgId);
    return await this._call(`orgs/${resolvedOrgId}/workspaces`, params, 'POST');
  }

  public async getWorkspace(options: GetWorkspaceOptions): Promise<IWorkspace> {
    const { workspaceId } = options;
    return await this._call(`workspaces/${workspaceId}`);
  }

  public async getWorkspaceByName(options: GetWorkspaceByNameOptions): Promise<IWorkspace | undefined> {
    const { name, orgId } = options;
    const workspaces = await this.listWorkspaces({ orgId });
    return workspaces.find((workspace: IWorkspace) => workspace.name === name);
  }

  public async modifyWorkspace(options: ModifyWorkspaceOptions): Promise<void> {
    const { workspaceId, ...params } = options;
    await this._call(`workspaces/${workspaceId}`, params, 'PATCH');
  }

  public async deleteWorkspace(options: DeleteWorkspaceOptions): Promise<void> {
    const { workspaceId } = options;
    await this._call(`workspaces/${workspaceId}`, undefined, 'DELETE');
  }

  public async getWorkspaceAccess(options: GetWorkspaceAccessOptions): Promise<IWorkspaceAccessRead> {
    const { workspaceId } = options;
    return await this._call(`workspaces/${workspaceId}/access`);
  }

  public async modifyWorkspaceAccess(options: ModifyWorkspaceAccessOptions): Promise<void> {
    const { workspaceId, delta } = options;
    await this._call(`workspaces/${workspaceId}/access`, { delta }, 'PATCH');
  }

  // Document endpoints using options object
  public async createDoc(options: CreateDocOptions): Promise<string> {
    const { workspaceId, ...params } = options;
    return await this._call(`workspaces/${workspaceId}/docs`, params, 'POST');
  }

  public async getDoc(options: GetDocOptions = {}): Promise<IDoc> {
    const { docId } = options;
    return await this._docCall('', undefined, 'GET', undefined, docId);
  }

  public async getDocByName(options: GetDocByNameOptions): Promise<IDoc | undefined> {
    const { name, workspaceId } = options;
    const workspace = await this.getWorkspace({ workspaceId });
    return workspace.docs?.find((doc: IDoc) => doc.name === name);
  }

  public async modifyDoc(options: ModifyDocOptions): Promise<void> {
    const { docId, ...params } = options;
    await this._docCall('', params, 'PATCH', undefined, docId);
  }

  public async deleteDoc(options: DeleteDocOptions = {}): Promise<void> {
    const { docId } = options;
    await this._docCall('', undefined, 'DELETE', undefined, docId);
  }

  public async moveDoc(options: MoveDocOptions): Promise<void> {
    const { docId, workspaceId } = options;
    await this._docCall('move', { workspace: workspaceId }, 'PATCH', undefined, docId);
  }

  public async getDocAccess(options: GetDocAccessOptions = {}): Promise<IWorkspaceAccessRead> {
    const { docId } = options;
    return await this._docCall('access', undefined, 'GET', undefined, docId);
  }

  public async modifyDocAccess(options: ModifyDocAccessOptions): Promise<void> {
    const { docId, delta } = options;
    await this._docCall('access', { delta }, 'PATCH', undefined, docId);
  }

  public async downloadDoc(options: DownloadDocOptions = {}): Promise<ArrayBuffer> {
    const { docId, nohistory, template } = options;
    const query = new URLSearchParams();
    if (nohistory) { query.set('nohistory', 'true'); }
    if (template) { query.set('template', 'true'); }
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return await this._docCall(`download${queryStr}`, undefined, 'GET', 'arraybuffer' as ResponseType, docId);
  }

  public async createTable(options: CreateTableOptions): Promise<number> {
    const { docId, ...params } = options;
    return await this._docCall(`tables`, params.schema, 'POST', undefined, docId);
  }

  public async listTables(options: ListTablesOptions): Promise<ITable[]> {
    const { docId } = options;
    let tables = await this._docCall(`tables`, undefined, 'GET', undefined, docId);
    return tables.tables;
  }

  public async getTable(options: GetTableOptions): Promise<ITable | undefined | null> {
    const { tableId, docId } = options;
    const tables = await this.listTables({ docId });
    return tables.find((table) => table.id === tableId);
  }

  public async getTableById(options: GetTableByIdOptions): Promise<ITable | undefined | null> {
    const { tableId, docId } = options;
    const tables = await this.listTables({ docId });
    return tables.find((table) => table.id === tableId);
  }

  public async getTableByName(options: GetTableByNameOptions): Promise<ITable | undefined | null> {
    const { name, docId } = options;
    const tables = await this.listTables({ docId });
    console.log('------tables------', tables);
    return tables.find((table) => table.id === name);
  }

  public async fetchTable(options: FetchTableOptions): Promise<IRecord[]> {
    const { tableName, filters, docId } = options;
    const query = filters ? `?filter=${encodeURIComponent(JSON.stringify(filters))}` : '';
    const data: ITableData = await this._docCall(`tables/${tableName}/data${query}`, undefined, 'GET', undefined, docId);
    if (!Array.isArray(data.id)) {
      throw new Error(`fetchTable ${tableName} returned bad response: id column is not an array`);
    }
    return data.id.map((id, index) => mapValues(data, (col) => col[index]));
  }

  public async addRecords(options: AddRecordsOptions): Promise<number[]> {
    console.log('------addRecords------', options);
    const { tableName, records, docId } = options;
    if (records.length === 0) { return []; }

    const callData: ITableData[] = chunk(records, this._chunkSize).map((recs) => makeTableData(recs));
    console.log('------callData------', callData);

    const results: number[] = [];
    for (const data of callData) {
      const resp = await this._docCall(`tables/${tableName}/data`, data, 'POST', undefined, docId);
      results.push(...(resp || []));
    }
    return results;
  }

  public async deleteRecords(options: DeleteRecordsOptions): Promise<void> {
    const { tableName, recordIds, docId } = options;
    for (const recIds of chunk(recordIds, this._chunkSize)) {
      const data = [['BulkRemoveRecord', tableName, recIds]];
      await this._docCall('apply', data, 'POST', undefined, docId);
    }
  }

  public async updateRecords(options: UpdateRecordsOptions): Promise<void> {
    const { tableName, records, docId } = options;
    const groups = new Map<string, IRecord[]>();
    for (const rec of records) {
      if (!rec.id || typeof rec.id !== 'number') {
        throw new Error("updateRecord requires numeric 'id' attribute in each record");
      }
      const key = JSON.stringify(Object.keys(rec).sort());
      const group = groups.get(key) || groups.set(key, []).get(key)!;
      group.push(rec);
    }

    const callData: ITableData[] = [];
    for (const groupRecords of groups.values()) {
      callData.push(...chunk(groupRecords, this._chunkSize).map((recs) => makeTableData(recs)));
    }

    for (const data of callData) {
      await this._docCall(`tables/${tableName}/data`, data, 'PATCH', undefined, docId);
    }
  }

  public async syncTable(options: SyncTableOptions): Promise<{numAdded: number, numUpdated: number}> {
    const { tableName, records, keyColIds, filters, docId } = options;
    if (filters && !Object.keys(filters).every((colId) => keyColIds.includes(colId))) {
      throw new Error("syncTable requires key columns to include all filter columns");
    }

    const gristRows = new Map<string, IRecord>();
    // Use fetchTable with its own options structure
    const fetchedData = await this.fetchTable({
      tableName,
      filters,
      docId
    });
    for (const oldRec of fetchedData) {
      const key = makeKey(oldRec, keyColIds);
      gristRows.set(key, oldRec);
    }

    const updateList: IRecord[] = [];
    const addList: IRecord[] = [];
    for (const newRec of records) {
      if (filters && !filterMatches(newRec, filters)) {
        continue;
      }
      const key = makeKey(newRec, keyColIds);
      const oldRec = gristRows.get(key);
      if (oldRec) {
        const changedKeys = Object.keys(newRec).filter((colId) => !isEqual(newRec[colId], oldRec[colId]));
        if (changedKeys.length > 0) {
          const update: IRecord = pick(newRec, changedKeys);
          update.id = oldRec.id;
          updateList.push(update);
        }
      } else {
        addList.push(newRec);
      }
    }

    // Use updateRecords and addRecords with their own options structures
    await this.updateRecords({ tableName, records: updateList, docId });
    await this.addRecords({ tableName, records: addList, docId });
    return {numAdded: addList.length, numUpdated: updateList.length};
  }

  public async attach(options: AttachOptions): Promise<number[]> {
    const { files, docId } = options;
    const formData = new FormData();
    for (const file of files) {
      formData.append('upload', file);
    }
    return await this._docCall('attach', formData, 'POST', undefined, docId);
  }

  private async _docCall(docRelUrl: string, data?: object|FormData, method?: Method, responseType?: ResponseType, docId?: string) {
    const resolvedDocId = this._resolveDocId(docId);
    const url = `docs/${resolvedDocId}/${docRelUrl}`.replace(/\/+$/, '');
    console.log('------url------', url);
    console.log('------data------', data);
    return await this._call(url, data, method, responseType);
  }

  private async _call(url: string, data?: object|FormData, method?: Method, responseType?: ResponseType) {
    if (!this._apiKey) {
      this._apiKey = await getAPIKey();
    }
    method = method || (data ? 'POST' : 'GET');
    const config: AxiosRequestConfig = {
      method,
      url: `${this._server}/${url}`.replace(/\/+$/, ''),
      headers: {
        'Authorization': `Bearer ${this._apiKey}`,
      },
      data,
      responseType,
    };
    // console.log('------config------', config, this);
    if (this._dryrun && method !== 'GET') {
      return;
    }
    try {
      const resp = await axios(config);
      // console.log('------resp------', resp);
      return resp.data;
    } catch (err) {
      const axiosError = err as AxiosError;
      // console.log('------axiosError------', axiosError);
      if (axiosError.response?.data && typeof axiosError.response.data === 'object' && 'error' in axiosError.response.data) {
        throw new Error(`Grist API error: ${axiosError.response.data.error}`);
      }
      throw err;
    }
  }
}

/**
 * Returns a human-readable summary of the given ITableData object (dict mapping column name to
 * list of values).
 */
// function descColValues(data: ITableData): string {
//   const keys = Object.keys(data);
//   const numRows = keys.length > 0 ? data[keys[0]].length : 0;
//   const columns = keys.sort().join(', ');
//   return `${numRows} rows, cols (${columns})`;
// }

/**
 * Converts an array of records into a column-oriented ITableData object.
 */
function makeTableData(records: IRecord[]): ITableData {
  console.log('------makeTableData------', records);
  const allKeys = new Set<string>();
  for (const rec of records) {
    for (const key of Object.keys(rec)) {
      allKeys.add(key);
    }
  }
  console.log('------allKeys------', allKeys);
  
  // Create an object directly instead of using mapValues
  const result: Record<string, any[]> = {};
  Array.from(allKeys).forEach(key => {
    result[key] = records.map(rec => rec[key]);
  });
  
  return result;
}


function makeKey(rec: IRecord, keyColumns: string[]): string {
  return JSON.stringify(keyColumns.map((col) => rec[col]));
}

/**
 * Checks if a record matches a set of filters.
 */
function filterMatches(rec: IRecord, filters: IFilterSpec): boolean {
  return Object.keys(filters).every((colId) => filters[colId].includes(rec[colId]));
}
