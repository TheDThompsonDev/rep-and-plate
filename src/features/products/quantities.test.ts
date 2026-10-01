import {expect,it} from 'vitest';
import {packageServings} from './quantities';
it('counts labeled servings across packages without assuming unknown values',()=>{
  expect(packageServings('2','5')).toBe(10);
  expect(packageServings('1.5','2.5')).toBe(3.75);
  for(const [count,servings] of [['','5'],['2',''],['-1','5'],['NaN','5'],['1000','1000']])expect(packageServings(count,servings)).toBeNull();
});
