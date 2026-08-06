// ============================================================
// Tests: core/project-file.ts
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportToKcproj,
  downloadKcprojFile,
  parseKcproj,
  readKcprojFile,
} from '@/core/project-file';
import type { ProjectState, ProjectFile } from '@/core/project-types';

const PROJECT_FORMAT_VERSION = '1.0';

const sampleState: ProjectState = {
  groups: [
    {
      id: 'g1',
      name: 'Group 1',
      parentId: null,
      isExpanded: true,
      isTrash: false,
      color: '',
      createdAt: Date.now(),
    },
  ],
  phrases: [
    {
      id: 'p1',
      text: 'keyword',
      groupId: 'g1',
      frequency: 100,
      kei: 0,
      cpc: 0,
      competition: 0,
      notes: '',
      createdAt: Date.now(),
    },
  ],
  minusWords: [{ id: 'mw1', text: 'bad word', groupId: null, isExact: false, searchType: 'broad', createdAt: Date.now() }],
  settings: {},
  uiState: {},
};

function makeValidKcprojJson(overrides: Record<string, any> = {}): string {
  const obj = {
    version: PROJECT_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: 'Test Project',
    state: sampleState,
    ...overrides,
  };
  return JSON.stringify(obj);
}

// ============================================================
// exportToKcproj
// ============================================================

describe('exportToKcproj', () => {
  it('should return a valid JSON string', () => {
    const result = exportToKcproj('MyProject', sampleState);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should include the correct version', () => {
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState));
    expect(parsed.version).toBe(PROJECT_FORMAT_VERSION);
  });

  it('should include createdAt as an ISO string', () => {
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState));
    expect(parsed.createdAt).toBeTruthy();
    expect(new Date(parsed.createdAt).toISOString()).toBe(parsed.createdAt);
  });

  it('should include updatedAt equal to createdAt when no existingUpdatedAt provided', () => {
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState));
    expect(parsed.updatedAt).toBe(parsed.createdAt);
  });

  it('should use existingUpdatedAt when provided', () => {
    const existing = '2024-01-15T10:30:00.000Z';
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState, existing));
    expect(parsed.updatedAt).toBe(existing);
    expect(parsed.createdAt).not.toBe(existing); // createdAt should be new
  });

  it('should include the project name', () => {
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState));
    expect(parsed.name).toBe('MyProject');
  });

  it('should include the full state', () => {
    const parsed = JSON.parse(exportToKcproj('MyProject', sampleState));
    expect(parsed.state).toEqual(sampleState);
  });

  it('should produce pretty-printed JSON (2-space indent)', () => {
    const result = exportToKcproj('MyProject', sampleState);
    // Pretty-printed JSON contains newlines and 2-space indentation
    expect(result).toContain('\n');
    expect(result).toContain('  '); // 2-space indent
  });
});

// ============================================================
// parseKcproj
// ============================================================

describe('parseKcproj', () => {
  it('should parse a valid .kcproj JSON string', () => {
    const json = makeValidKcprojJson();
    const result = parseKcproj(json);
    expect(result.version).toBe(PROJECT_FORMAT_VERSION);
    expect(result.name).toBe('Test Project');
    expect(result.state).toEqual(sampleState);
  });

  it('should throw if input is an array (passes typeof object but fails validation)', () => {
    // Arrays are typeof 'object', so they pass the first check but fail on missing fields
    expect(() => parseKcproj('[1,2,3]')).toThrow('Invalid .kcproj file');
  });

  it('should throw if input is not a JSON object (primitive)', () => {
    expect(() => parseKcproj('"hello"')).toThrow(
      'Invalid .kcproj file: not a JSON object'
    );
  });

  it('should throw if input is null JSON', () => {
    expect(() => parseKcproj('null')).toThrow(
      'Invalid .kcproj file: not a JSON object'
    );
  });

  it('should throw if version is missing', () => {
    const json = makeValidKcprojJson({ version: undefined });
    const obj = JSON.parse(json);
    delete obj.version;
    expect(() => parseKcproj(JSON.stringify(obj))).toThrow(
      'Invalid .kcproj file: missing "version" field'
    );
  });

  it('should throw if version is not a string', () => {
    const json = makeValidKcprojJson({ version: 1 });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: missing "version" field'
    );
  });

  it('should throw if name is missing', () => {
    const json = makeValidKcprojJson({ name: undefined });
    const obj = JSON.parse(json);
    delete obj.name;
    expect(() => parseKcproj(JSON.stringify(obj))).toThrow(
      'Invalid .kcproj file: missing "name" field'
    );
  });

  it('should throw if name is not a string', () => {
    const json = makeValidKcprojJson({ name: 42 });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: missing "name" field'
    );
  });

  it('should throw if state is missing', () => {
    const json = makeValidKcprojJson({ state: undefined });
    const obj = JSON.parse(json);
    delete obj.state;
    expect(() => parseKcproj(JSON.stringify(obj))).toThrow(
      'Invalid .kcproj file: missing "state" field'
    );
  });

  it('should throw if state is not an object', () => {
    const json = makeValidKcprojJson({ state: 'not an object' });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: missing "state" field'
    );
  });

  it('should throw if state.groups is not an array', () => {
    const json = makeValidKcprojJson({
      state: { ...sampleState, groups: 'not array' },
    });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: state.groups must be an array'
    );
  });

  it('should throw if state.phrases is not an array', () => {
    const json = makeValidKcprojJson({
      state: { ...sampleState, phrases: 'not array' },
    });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: state.phrases must be an array'
    );
  });

  it('should throw if state.minusWords is not an array', () => {
    const json = makeValidKcprojJson({
      state: { ...sampleState, minusWords: 'not array' },
    });
    expect(() => parseKcproj(json)).toThrow(
      'Invalid .kcproj file: state.minusWords must be an array'
    );
  });

  it('should throw on incompatible major version', () => {
    const json = makeValidKcprojJson({ version: '2.0' });
    expect(() => parseKcproj(json)).toThrow(
      `Incompatible .kcproj version: file is v2.0, expected v${PROJECT_FORMAT_VERSION}.x`
    );
  });

  it('should accept a compatible major version with different minor', () => {
    // e.g. if current is "1.0", "1.5" should be compatible
    const json = makeValidKcprojJson({ version: '1.5' });
    const result = parseKcproj(json);
    expect(result.version).toBe('1.5');
  });

  it('should throw on invalid JSON syntax', () => {
    expect(() => parseKcproj('{invalid json')).toThrow();
  });
});

// ============================================================
// readKcprojFile
// ============================================================

describe('readKcprojFile', () => {
  let mockReaderInstance: {
    readAsText: ReturnType<typeof vi.fn>;
    onload: ((ev: any) => void) | null;
    onerror: ((ev: any) => void) | null;
    result: string | null;
  };

  beforeEach(() => {
    mockReaderInstance = {
      readAsText: vi.fn(),
      onload: null,
      onerror: null,
      result: null,
    };
    // Use a class-based mock so `new FileReader()` works
    const instance = mockReaderInstance;
    vi.stubGlobal('FileReader', class {
      readAsText = instance.readAsText;
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      result: string | null = null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should resolve with a parsed ProjectFile on successful read', async () => {
    const validJson = makeValidKcprojJson();

    const file = new File([''], 'test.kcproj', { type: 'application/json' });
    const promise = readKcprojFile(file);

    // After readKcprojFile runs, the FileReader instance has onload set.
    // We need to grab it from the actual instance created.
    // Since our stub class copies the readAsText from the shared mock,
    // but onload/onerror are per-instance, we need a different approach.
    // Let's capture the instance directly.
    vi.unstubAllGlobals();

    // Re-stub with a capturing approach
    let capturedInstance: any = null;
    vi.stubGlobal('FileReader', class {
      readAsText = vi.fn();
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      result: string | null = null;
      constructor() {
        capturedInstance = this;
      }
    });

    const promise2 = readKcprojFile(file);
    capturedInstance.result = validJson;
    capturedInstance.onload!({} as Event);

    const result = await promise2;
    expect(result.version).toBe(PROJECT_FORMAT_VERSION);
    expect(result.name).toBe('Test Project');
  });

  it('should call readAsText with the file', async () => {
    let capturedInstance: any = null;
    vi.stubGlobal('FileReader', class {
      readAsText = vi.fn();
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      result: string | null = null;
      constructor() {
        capturedInstance = this;
      }
    });

    const file = new File([''], 'test.kcproj', { type: 'application/json' });
    readKcprojFile(file);

    expect(capturedInstance.readAsText).toHaveBeenCalledWith(file);
  });

  it('should reject on FileReader error', async () => {
    let capturedInstance: any = null;
    vi.stubGlobal('FileReader', class {
      readAsText = vi.fn();
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      result: string | null = null;
      constructor() {
        capturedInstance = this;
      }
    });

    const file = new File([''], 'test.kcproj', { type: 'application/json' });
    const promise = readKcprojFile(file);

    // Simulate error
    capturedInstance.onerror!({} as Event);

    await expect(promise).rejects.toThrow('Failed to read file');
  });

  it('should reject when parsed content is invalid', async () => {
    let capturedInstance: any = null;
    vi.stubGlobal('FileReader', class {
      readAsText = vi.fn();
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      result: string | null = null;
      constructor() {
        capturedInstance = this;
      }
    });

    const file = new File([''], 'test.kcproj', { type: 'application/json' });
    const promise = readKcprojFile(file);

    capturedInstance.result = 'not valid kcproj';
    capturedInstance.onload!({} as Event);

    await expect(promise).rejects.toThrow();
  });
});

// ============================================================
// downloadKcprojFile
// ============================================================

describe('downloadKcprojFile', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockLink: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };
  let mockAppendChild: ReturnType<typeof vi.fn>;
  let mockRemoveChild: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreateObjectURL = vi.fn(() => 'blob:test-url');
    mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    mockAppendChild = vi.fn();
    mockRemoveChild = vi.fn();

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as (child: Node) => Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as (child: Node) => Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should create an object URL from a Blob', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockCreateObjectURL).toHaveBeenCalled();
    // The argument should be a Blob instance
    expect(mockCreateObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('should create a Blob with application/json type', () => {
    downloadKcprojFile('My Project', sampleState);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
  });

  it('should create a Blob containing the JSON string', async () => {
    downloadKcprojFile('My Project', sampleState);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe('My Project');
    expect(parsed.version).toBe(PROJECT_FORMAT_VERSION);
  });

  it('should set link href to the object URL', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockLink.href).toBe('blob:test-url');
  });

  it('should set link download to sanitized filename with .kcproj extension', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockLink.download).toBe('my_project.kcproj');
  });

  it('should sanitize special characters in the filename (collapse underscores)', () => {
    // sanitizeFilename replaces [<>:"/\\|?*] with _, spaces with _, collapses multiple _ to single _
    downloadKcprojFile('My<>:"/\\|?*Project', sampleState);
    // My<>:"/\\|?*Project → My___________Project → My_Project (collapsed) → my_project
    expect(mockLink.download).toBe('my_project.kcproj');
  });

  it('should replace spaces with underscores in the filename', () => {
    downloadKcprojFile('Hello World', sampleState);
    expect(mockLink.download).toBe('hello_world.kcproj');
  });

  it('should click the link to trigger download', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockLink.click).toHaveBeenCalledOnce();
  });

  it('should append and remove the link from the DOM', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
  });

  it('should revoke the object URL after download', () => {
    downloadKcprojFile('My Project', sampleState);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});
