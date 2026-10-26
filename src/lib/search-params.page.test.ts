import {describe,it,expect} from 'vitest';
import {normalizePage} from './search-params';
describe('safe pagination',()=>{
 it.each(['-1','0','1.5','Infinity','NaN','1e6','999999999999999999',undefined])('normalizes unsafe page %s',value=>expect(normalizePage(value)).toBe(1));
 it('keeps valid pages and normalizes arrays',()=>{expect(normalizePage('2')).toBe(2);expect(normalizePage(['3','4'])).toBe(3);});
});
