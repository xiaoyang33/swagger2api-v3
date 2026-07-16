import * as fs from 'fs';
import * as path from 'path';
describe('JSON Config Schema', () => {
  test('should provide local JSON schema for editor hints', () => {
    const schemaPath = path.resolve(
      __dirname,
      '../build/.swagger2api.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.filter.properties.include.properties.tags).toEqual(
      {
        type: 'array',
        items: { type: 'string' }
      }
    );
    expect(schema.properties.headerComment.type).toBe('string');
  });
});
