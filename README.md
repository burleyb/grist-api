# Grist API Library

A TypeScript/JavaScript client library for interacting with the Grist API.

## Installation

```bash
npm install grist-api
```

## Quick Start

```typescript
import { GristDocAPI } from 'grist-api';

// Initialize the API client
const api = new GristDocAPI({
  apiKey: 'your-api-key',  // Optional: can also be read from GRIST_API_KEY env var or ~/.grist-api-key
  server: 'https://api.getgrist.com',  // Optional: defaults to https://api.getgrist.com
});

// Set document context (required for document operations)
api.setDocId('doc-id-or-url');

// Example: Fetch records from a table
const records = await api.fetchTable({
  tableName: 'Table1',
  filters: { category: ['electronics', 'books'] }  // Optional filters
});
```

## Authentication

The library supports three ways to provide your Grist API key:

1. Pass it directly when creating the client:
```typescript
const api = new GristDocAPI({ apiKey: 'your-api-key' });
```

2. Set the `GRIST_API_KEY` environment variable

3. Store it in `~/.grist-api-key` file

## API Reference

### Organization Operations

```typescript
// List all organizations
const orgs = await api.listOrgs();

// Get organization by ID
const org = await api.getOrg({ orgId: 123 });

// Get organization by name
const org = await api.getOrgByName({ name: 'My Org' });

// Get organization by domain
const org = await api.getOrgByDomain({ domain: 'example.com' });

// Modify organization
await api.modifyOrg({ 
  orgId: 123,
  name: 'New Org Name'
});

// Manage organization access
await api.modifyOrgAccess({
  orgId: 123,
  delta: {
    users: {
      'user@example.com': 'editors'
    }
  }
});
```

### Workspace Operations

```typescript
// List workspaces
const workspaces = await api.listWorkspaces({ orgId: 123 });

// Create workspace
const workspaceId = await api.createWorkspace({
  orgId: 123,
  name: 'New Workspace'
});

// Get workspace
const workspace = await api.getWorkspace({ workspaceId: 456 });

// Modify workspace
await api.modifyWorkspace({
  workspaceId: 456,
  name: 'Updated Workspace'
});

// Manage workspace access
await api.modifyWorkspaceAccess({
  workspaceId: 456,
  delta: {
    users: {
      'user@example.com': 'editors'
    }
  }
});
```

### Document Operations

```typescript
// Create document
const docId = await api.createDoc({
  workspaceId: 456,
  name: 'New Document'
});

// Get document
const doc = await api.getDoc();

// Get document by name
const doc = await api.getDocByName({
  workspaceId: 456,
  name: 'My Document'
});

// Modify document
await api.modifyDoc({
  name: 'Updated Document'
});

// Move document
await api.moveDoc({
  workspaceId: 789  // destination workspace
});

// Download document
const docData = await api.downloadDoc({
  nohistory: true,  // Optional: exclude history
  template: true    // Optional: download as template
});
```

### Table Operations

```typescript
// Create table
const tableId = await api.createTable({
  schema: {
    tables: [{
      id: 'Table1',
      columns: [
        { id: 'Name', fields: { label: 'Name' } },
        { id: 'Age', fields: { label: 'Age' } }
      ]
    }]
  }
});

// List tables
const tables = await api.listTables();

// Get table by ID
const table = await api.getTableById({ tableId: 'Table1' });

// Fetch table data
const records = await api.fetchTable({
  tableName: 'Table1',
  filters: {    // Optional filters
    category: ['electronics', 'books']
  }
});

// Add records
const newIds = await api.addRecords({
  tableName: 'Table1',
  records: [
    { Name: 'John', Age: 30 },
    { Name: 'Jane', Age: 25 }
  ]
});

// Update records
await api.updateRecords({
  tableName: 'Table1',
  records: [
    { id: 1, Name: 'John Updated' },
    { id: 2, Age: 26 }
  ]
});

// Delete records
await api.deleteRecords({
  tableName: 'Table1',
  recordIds: [1, 2, 3]
});

// Sync table (upsert based on key columns)
const result = await api.syncTable({
  tableName: 'Table1',
  records: [
    { Name: 'John', Age: 31 },
    { Name: 'Jane', Age: 26 }
  ],
  keyColIds: ['Name'],
  filters: { Age: [25, 30] }  // Optional
});
```

### File Attachments

```typescript
// Attach files
const attachmentIds = await api.attach({
  files: [file1, file2]  // File objects
});
```

## Error Handling

The library throws errors with descriptive messages when API calls fail:

```typescript
try {
  await api.fetchTable({ tableName: 'NonExistentTable' });
} catch (error) {
  console.error('API Error:', error.message);
}
```

## Configuration Options

The `GristDocAPI` constructor accepts these options:

```typescript
const api = new GristDocAPI({
  apiKey?: string;      // API key for authentication
  server?: string;      // API server URL (default: 'https://api.getgrist.com')
  dryrun?: boolean;     // If true, skips actual API calls (for testing)
  chunkSize?: number;   // Batch size for bulk operations (default: 500)
});
```

## Types

The library includes TypeScript type definitions for all API operations. Key types include:

- `CellValue`: Values in Grist data cells (number|string|boolean|null|[string, ...any[]])
- `IRecord`: Record representing a row in a Grist table
- `ITableData`: Column-oriented data format used by Grist
- `AccessLevel`: 'owners' | 'editors' | 'viewers' | 'members' | null
- `IFilterSpec`: Specification for filtering table data

## Contributing

Contributions are welcome! Please submit issues and pull requests on GitHub.

## License

[License information goes here]
