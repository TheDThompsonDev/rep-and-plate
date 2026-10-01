/** Package counts are explicit user inputs; never infer them from receipt text. */
export function packageServings(packages:string,servingsPerPackage:string):number|null {
  if(!packages.trim()||!servingsPerPackage.trim())return null;
  const count=Number(packages),servings=Number(servingsPerPackage),total=count*servings;
  return Number.isFinite(total)&&count>0&&servings>0&&total<=10000?Math.round(total*10000)/10000:null;
}
