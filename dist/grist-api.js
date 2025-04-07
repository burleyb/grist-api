"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GristDocAPI = exports.getAPIKey = void 0;
/**
 * Client-side library to interact with Grist.
 */
const axios_1 = require("axios");
const chunk = require("lodash/chunk");
const isEqual = require("lodash/isEqual");
const mapValues = require("lodash/mapValues");
const pick = require("lodash/pick");
async function getAPIKey() {
    if (typeof process === 'undefined') {
        throw new Error('In browser environment, Grist API key must be provided');
    }
    // Otherwise, assume we are in node environment.
    if (process.env.GRIST_API_KEY !== undefined) {
        return process.env.GRIST_API_KEY;
    }
    const os = require('os');
    const path = require('path');
    const fse = require('fs-extra');
    const keyPath = path.join(os.homedir(), ".grist-api-key");
    if (await fse.pathExists(keyPath)) {
        return (await fse.readFile(keyPath, { encoding: 'utf8' })).trim();
    }
    throw new Error(`Grist API key not given, or found in GRIST_API_KEY env, or in ${keyPath}`);
}
exports.getAPIKey = getAPIKey;
/**
 * Class for interacting with Grist API.
 */
class GristDocAPI {
    constructor(options = {}) {
        var _a;
        this._dryrun = Boolean(options.dryrun);
        this._server = options.server || 'https://api.getgrist.com';
        this._apiKey = (_a = options.apiKey) !== null && _a !== void 0 ? _a : null;
        this._chunkSize = options.chunkSize || 500;
        this._docId = null;
        this._orgId = null;
    }
    /**
     * Sets the organization context for organization-specific operations.
     */
    setOrgId(orgId) {
        this._orgId = orgId;
    }
    /**
     * Set the document context for document-specific operations.
     * You may specify either a doc URL, or just the doc ID (the part of the URL after "/doc/").
     * If you specify a URL, then the server from the URL will be used.
     */
    setDocId(docUrlOrId) {
        const match = /^(https?:\/\/[^\/]+(?:\/o\/[^\/]+)?)\/(?:doc\/([^\/?#]+)|([^\/?#]{12,}))/.exec(docUrlOrId);
        if (match) {
            this._server = match[1];
            this._docId = match[2] || match[3];
        }
        else {
            this._docId = docUrlOrId;
        }
    }
    /**
     * Resolves the orgId to use, prioritizing passed parameter over class context.
     * Throws if neither is available.
     */
    _resolveOrgId(orgId) {
        const idToUse = orgId !== null && orgId !== void 0 ? orgId : this._orgId;
        if (!idToUse) {
            throw new Error('No organization context set or provided. Call setOrgId() or pass orgId in options.');
        }
        return idToUse;
    }
    /**
     * Resolves the docId to use, prioritizing passed parameter over class context.
     * Throws if neither is available.
     */
    _resolveDocId(docId) {
        const idToUse = docId !== null && docId !== void 0 ? docId : this._docId;
        if (!idToUse) {
            throw new Error('No document context set or provided. Call setDocId() or pass docId in options.');
        }
        return idToUse;
    }
    get docId() { return this._docId; }
    get orgId() { return this._orgId; }
    // Organization endpoints using options object
    async listOrgs() {
        return await this._call('orgs');
    }
    async getOrg(options) {
        const { orgId } = options;
        return await this._call(`orgs/${orgId}`);
    }
    async getOrgByName(options) {
        const { name } = options;
        const orgs = await this.listOrgs();
        return orgs.find((org) => org.name === name);
    }
    async getOrgByDomain(options) {
        const { domain } = options;
        const orgs = await this.listOrgs();
        return orgs.find((org) => org.domain === domain);
    }
    async modifyOrg(options) {
        const { orgId } = options, params = __rest(options, ["orgId"]);
        await this._call(`orgs/${orgId}`, params, 'PATCH');
    }
    async deleteOrg(options) {
        const { orgId } = options;
        await this._call(`orgs/${orgId}`, undefined, 'DELETE');
    }
    async getOrgAccess(options) {
        const { orgId } = options;
        return await this._call(`orgs/${orgId}/access`);
    }
    async modifyOrgAccess(options) {
        const { orgId, delta } = options;
        await this._call(`orgs/${orgId}/access`, { delta }, 'PATCH');
    }
    // Workspace endpoints using options object
    async listWorkspaces(options = {}) {
        const { orgId } = options;
        const resolvedOrgId = this._resolveOrgId(orgId);
        return await this._call(`orgs/${resolvedOrgId}/workspaces`);
    }
    async createWorkspace(options) {
        const { orgId } = options, params = __rest(options, ["orgId"]);
        const resolvedOrgId = this._resolveOrgId(orgId);
        return await this._call(`orgs/${resolvedOrgId}/workspaces`, params, 'POST');
    }
    async getWorkspace(options) {
        const { workspaceId } = options;
        return await this._call(`workspaces/${workspaceId}`);
    }
    async getWorkspaceByName(options) {
        const { name, orgId } = options;
        const workspaces = await this.listWorkspaces({ orgId });
        return workspaces.find((workspace) => workspace.name === name);
    }
    async modifyWorkspace(options) {
        const { workspaceId } = options, params = __rest(options, ["workspaceId"]);
        await this._call(`workspaces/${workspaceId}`, params, 'PATCH');
    }
    async deleteWorkspace(options) {
        const { workspaceId } = options;
        await this._call(`workspaces/${workspaceId}`, undefined, 'DELETE');
    }
    async getWorkspaceAccess(options) {
        const { workspaceId } = options;
        return await this._call(`workspaces/${workspaceId}/access`);
    }
    async modifyWorkspaceAccess(options) {
        const { workspaceId, delta } = options;
        await this._call(`workspaces/${workspaceId}/access`, { delta }, 'PATCH');
    }
    // Document endpoints using options object
    async createDoc(options) {
        const { workspaceId } = options, params = __rest(options, ["workspaceId"]);
        return await this._call(`workspaces/${workspaceId}/docs`, params, 'POST');
    }
    async getDoc(options = {}) {
        const { docId } = options;
        return await this._docCall('', undefined, 'GET', undefined, docId);
    }
    async getDocByName(options) {
        var _a;
        const { name, workspaceId } = options;
        const workspace = await this.getWorkspace({ workspaceId });
        return (_a = workspace.docs) === null || _a === void 0 ? void 0 : _a.find((doc) => doc.name === name);
    }
    async modifyDoc(options) {
        const { docId } = options, params = __rest(options, ["docId"]);
        await this._docCall('', params, 'PATCH', undefined, docId);
    }
    async deleteDoc(options = {}) {
        const { docId } = options;
        await this._docCall('', undefined, 'DELETE', undefined, docId);
    }
    async moveDoc(options) {
        const { docId, workspaceId } = options;
        await this._docCall('move', { workspace: workspaceId }, 'PATCH', undefined, docId);
    }
    async getDocAccess(options = {}) {
        const { docId } = options;
        return await this._docCall('access', undefined, 'GET', undefined, docId);
    }
    async modifyDocAccess(options) {
        const { docId, delta } = options;
        await this._docCall('access', { delta }, 'PATCH', undefined, docId);
    }
    async downloadDoc(options = {}) {
        const { docId, nohistory, template } = options;
        const query = new URLSearchParams();
        if (nohistory) {
            query.set('nohistory', 'true');
        }
        if (template) {
            query.set('template', 'true');
        }
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return await this._docCall(`download${queryStr}`, undefined, 'GET', 'arraybuffer', docId);
    }
    async createTable(options) {
        const { docId } = options, params = __rest(options, ["docId"]);
        return await this._docCall(`tables`, params, 'POST', undefined, docId);
    }
    async listTables(options) {
        const { docId } = options;
        let tables = await this._docCall(`tables`, undefined, 'GET', undefined, docId);
        return tables.tables;
    }
    async getTable(options) {
        const { tableId, docId } = options;
        const tables = await this.listTables({ docId });
        return tables.find((table) => table.id === tableId);
    }
    async getTableById(options) {
        const { tableId, docId } = options;
        const tables = await this.listTables({ docId });
        return tables.find((table) => table.id === tableId);
    }
    async getTableByName(options) {
        const { name, docId } = options;
        const tables = await this.listTables({ docId });
        console.log('------tables------', tables);
        return tables.find((table) => table.id === name);
    }
    async fetchTable(options) {
        const { tableName, filters, docId } = options;
        const query = filters ? `?filter=${encodeURIComponent(JSON.stringify(filters))}` : '';
        const data = await this._docCall(`tables/${tableName}/data${query}`, undefined, 'GET', undefined, docId);
        if (!Array.isArray(data.id)) {
            throw new Error(`fetchTable ${tableName} returned bad response: id column is not an array`);
        }
        return data.id.map((id, index) => mapValues(data, (col) => col[index]));
    }
    async addRecords(options) {
        console.log('------addRecords------', options);
        const { tableName, records, docId } = options;
        if (records.length === 0) {
            return [];
        }
        const callData = chunk(records, this._chunkSize).map((recs) => makeTableData(recs));
        console.log('------callData------', callData);
        const results = [];
        for (const data of callData) {
            const resp = await this._docCall(`tables/${tableName}/data`, data, 'POST', undefined, docId);
            results.push(...(resp || []));
        }
        return results;
    }
    async deleteRecords(options) {
        const { tableName, recordIds, docId } = options;
        for (const recIds of chunk(recordIds, this._chunkSize)) {
            const data = [['BulkRemoveRecord', tableName, recIds]];
            await this._docCall('apply', data, 'POST', undefined, docId);
        }
    }
    async updateRecords(options) {
        const { tableName, records, docId } = options;
        const groups = new Map();
        for (const rec of records) {
            if (!rec.id || typeof rec.id !== 'number') {
                throw new Error("updateRecord requires numeric 'id' attribute in each record");
            }
            const key = JSON.stringify(Object.keys(rec).sort());
            const group = groups.get(key) || groups.set(key, []).get(key);
            group.push(rec);
        }
        const callData = [];
        for (const groupRecords of groups.values()) {
            callData.push(...chunk(groupRecords, this._chunkSize).map((recs) => makeTableData(recs)));
        }
        for (const data of callData) {
            await this._docCall(`tables/${tableName}/data`, data, 'PATCH', undefined, docId);
        }
    }
    async syncTable(options) {
        const { tableName, records, keyColIds, filters, docId } = options;
        if (filters && !Object.keys(filters).every((colId) => keyColIds.includes(colId))) {
            throw new Error("syncTable requires key columns to include all filter columns");
        }
        const gristRows = new Map();
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
        const updateList = [];
        const addList = [];
        for (const newRec of records) {
            if (filters && !filterMatches(newRec, filters)) {
                continue;
            }
            const key = makeKey(newRec, keyColIds);
            const oldRec = gristRows.get(key);
            if (oldRec) {
                const changedKeys = Object.keys(newRec).filter((colId) => !isEqual(newRec[colId], oldRec[colId]));
                if (changedKeys.length > 0) {
                    const update = pick(newRec, changedKeys);
                    update.id = oldRec.id;
                    updateList.push(update);
                }
            }
            else {
                addList.push(newRec);
            }
        }
        // Use updateRecords and addRecords with their own options structures
        await this.updateRecords({ tableName, records: updateList, docId });
        await this.addRecords({ tableName, records: addList, docId });
        return { numAdded: addList.length, numUpdated: updateList.length };
    }
    async attach(options) {
        const { files, docId } = options;
        const formData = new FormData();
        for (const file of files) {
            formData.append('upload', file);
        }
        return await this._docCall('attach', formData, 'POST', undefined, docId);
    }
    async _docCall(docRelUrl, data, method, responseType, docId) {
        const resolvedDocId = this._resolveDocId(docId);
        const url = `docs/${resolvedDocId}/${docRelUrl}`.replace(/\/+$/, '');
        console.log('------url------', url);
        console.log('------data------', data);
        return await this._call(url, data, method, responseType);
    }
    async _call(url, data, method, responseType) {
        var _a;
        if (!this._apiKey) {
            this._apiKey = await getAPIKey();
        }
        method = method || (data ? 'POST' : 'GET');
        const config = {
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
            const resp = await axios_1.default(config);
            // console.log('------resp------', resp);
            return resp.data;
        }
        catch (err) {
            const axiosError = err;
            // console.log('------axiosError------', axiosError);
            if (((_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) && typeof axiosError.response.data === 'object' && 'error' in axiosError.response.data) {
                throw new Error(`Grist API error: ${axiosError.response.data.error}`);
            }
            throw err;
        }
    }
}
exports.GristDocAPI = GristDocAPI;
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
function makeTableData(records) {
    console.log('------makeTableData------', records);
    const allKeys = new Set();
    for (const rec of records) {
        for (const key of Object.keys(rec)) {
            allKeys.add(key);
        }
    }
    console.log('------allKeys------', allKeys);
    // Create an object directly instead of using mapValues
    const result = {};
    Array.from(allKeys).forEach(key => {
        result[key] = records.map(rec => rec[key]);
    });
    return result;
}
function makeKey(rec, keyColumns) {
    return JSON.stringify(keyColumns.map((col) => rec[col]));
}
/**
 * Checks if a record matches a set of filters.
 */
function filterMatches(rec, filters) {
    return Object.keys(filters).every((colId) => filters[colId].includes(rec[colId]));
}
//# sourceMappingURL=grist-api.js.map