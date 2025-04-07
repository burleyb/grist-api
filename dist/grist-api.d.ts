export declare type CellValue = number | string | boolean | null | [string, ...any[]];
export interface IRecord {
    [colId: string]: CellValue;
}
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
export interface ITableData {
    [colId: string]: CellValue[];
}
export interface IFilterSpec {
    [colId: string]: CellValue[];
}
export declare type AccessLevel = 'owners' | 'editors' | 'viewers' | 'members' | null;
export interface IOrg {
    id: string | number;
    name: string;
    domain: string;
}
export interface IWorkspace {
    id: string | number;
    name: string;
    docs?: IDoc[];
}
export interface IDoc {
    id: string;
    name: string;
    workspace?: IWorkspace;
}
export interface IUserAccess {
    id: string | number;
    name: string;
    email?: string;
    access: AccessLevel;
}
export interface IAccessDelta {
    users: {
        [email: string]: AccessLevel;
    };
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
    users: {
        [email: string]: AccessLevel;
    };
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
export interface IGristCallConfig {
    apiKey?: string;
    server?: string;
    dryrun?: boolean;
    chunkSize?: number;
}
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
    workspaceId: string | number;
}
export interface ModifyWorkspaceOptions extends IWorkspaceParameters {
    workspaceId: string | number;
}
export interface DeleteWorkspaceOptions {
    workspaceId: string | number;
}
export interface GetWorkspaceAccessOptions {
    workspaceId: string | number;
}
export interface ModifyWorkspaceAccessOptions {
    workspaceId: string | number;
    delta: IWorkspaceAccessWrite;
}
export interface CreateDocOptions extends IDocParameters {
    workspaceId: string | number;
}
export interface GetDocOptions {
    docId?: string;
}
export interface GetDocByNameOptions {
    name: string;
    workspaceId: string | number;
}
export interface ModifyDocOptions extends IDocParameters {
    docId?: string;
}
export interface DeleteDocOptions {
    docId?: string;
}
export interface MoveDocOptions {
    workspaceId: string | number;
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
export declare function getAPIKey(): Promise<string>;
/**
 * Class for interacting with Grist API.
 */
export declare class GristDocAPI {
    private _dryrun;
    private _docId;
    private _server;
    private _apiKey;
    private _chunkSize;
    private _orgId;
    constructor(options?: IGristCallConfig);
    /**
     * Sets the organization context for organization-specific operations.
     */
    setOrgId(orgId: number | string): void;
    /**
     * Set the document context for document-specific operations.
     * You may specify either a doc URL, or just the doc ID (the part of the URL after "/doc/").
     * If you specify a URL, then the server from the URL will be used.
     */
    setDocId(docUrlOrId: string): void;
    /**
     * Resolves the orgId to use, prioritizing passed parameter over class context.
     * Throws if neither is available.
     */
    private _resolveOrgId;
    /**
     * Resolves the docId to use, prioritizing passed parameter over class context.
     * Throws if neither is available.
     */
    private _resolveDocId;
    get docId(): string | null;
    get orgId(): number | string | null;
    listOrgs(): Promise<IOrg[]>;
    getOrg(options: GetOrgOptions): Promise<IOrg>;
    getOrgByName(options: GetOrgByNameOptions): Promise<IOrg | undefined>;
    getOrgByDomain(options: GetOrgByDomainOptions): Promise<IOrg | undefined>;
    modifyOrg(options: ModifyOrgOptions): Promise<void>;
    deleteOrg(options: DeleteOrgOptions): Promise<void>;
    getOrgAccess(options: GetOrgAccessOptions): Promise<IUserAccess[]>;
    modifyOrgAccess(options: ModifyOrgAccessOptions): Promise<void>;
    listWorkspaces(options?: ListWorkspacesOptions): Promise<IWorkspace[]>;
    createWorkspace(options: CreateWorkspaceOptions): Promise<number>;
    getWorkspace(options: GetWorkspaceOptions): Promise<IWorkspace>;
    getWorkspaceByName(options: GetWorkspaceByNameOptions): Promise<IWorkspace | undefined>;
    modifyWorkspace(options: ModifyWorkspaceOptions): Promise<void>;
    deleteWorkspace(options: DeleteWorkspaceOptions): Promise<void>;
    getWorkspaceAccess(options: GetWorkspaceAccessOptions): Promise<IWorkspaceAccessRead>;
    modifyWorkspaceAccess(options: ModifyWorkspaceAccessOptions): Promise<void>;
    createDoc(options: CreateDocOptions): Promise<string>;
    getDoc(options?: GetDocOptions): Promise<IDoc>;
    getDocByName(options: GetDocByNameOptions): Promise<IDoc | undefined>;
    modifyDoc(options: ModifyDocOptions): Promise<void>;
    deleteDoc(options?: DeleteDocOptions): Promise<void>;
    moveDoc(options: MoveDocOptions): Promise<void>;
    getDocAccess(options?: GetDocAccessOptions): Promise<IWorkspaceAccessRead>;
    modifyDocAccess(options: ModifyDocAccessOptions): Promise<void>;
    downloadDoc(options?: DownloadDocOptions): Promise<ArrayBuffer>;
    createTable(options: CreateTableOptions): Promise<number>;
    listTables(options: ListTablesOptions): Promise<ITable[]>;
    getTable(options: GetTableOptions): Promise<ITable | undefined | null>;
    getTableById(options: GetTableByIdOptions): Promise<ITable | undefined | null>;
    getTableByName(options: GetTableByNameOptions): Promise<ITable | undefined | null>;
    fetchTable(options: FetchTableOptions): Promise<IRecord[]>;
    addRecords(options: AddRecordsOptions): Promise<number[]>;
    deleteRecords(options: DeleteRecordsOptions): Promise<void>;
    updateRecords(options: UpdateRecordsOptions): Promise<void>;
    syncTable(options: SyncTableOptions): Promise<{
        numAdded: number;
        numUpdated: number;
    }>;
    attach(options: AttachOptions): Promise<number[]>;
    private _docCall;
    private _call;
}
