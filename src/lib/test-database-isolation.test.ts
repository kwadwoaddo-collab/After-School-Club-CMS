import {describe,expect,it} from 'vitest';
import {assertTestDatabaseIsolation as check} from './test-database-isolation';
describe('default test database isolation',()=>{
 it.each([undefined,'postgres://user:secret@remote.example/production','postgres://user:secret@localhost/production','not-a-url'])('blocks unsafe DB initialization without disclosing credentials: %s',url=>{expect(()=>check({VITEST:'true',DATABASE_URL:url,TEST_ALLOW_INSECURE_TLS:'true'})).toThrow('Database access blocked');try{check({VITEST:'true',DATABASE_URL:url});}catch(error){expect(String(error)).not.toContain('secret');}});
 it('requires explicit opt-in even for a disposable local database',()=>{expect(()=>check({VITEST:'true',DATABASE_URL:'postgres://u:p@127.0.0.1/cms_test'})).toThrow();expect(()=>check({VITEST:'true',DATABASE_URL:'postgres://u:p@127.0.0.1/cms_test',TEST_ALLOW_INSECURE_TLS:'true'})).not.toThrow();});
 it('does not change production initialization',()=>{expect(()=>check({NODE_ENV:'production',DATABASE_URL:'postgres://u:p@remote.example/live'})).not.toThrow();});
});
