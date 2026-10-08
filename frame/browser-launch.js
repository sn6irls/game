// Browser launches are best-effort: host apps may require an OS confirmation.
export function browserLaunchURL(userAgent,pageURL){
 const target=new URL('./?v=13',pageURL),ua=userAgent.toLowerCase();
 if(ua.includes('kakaotalk'))return 'kakaotalk://web/openExternal?url='+encodeURIComponent(target.href);
 if(ua.includes('android')){
  const fallback=new URL(target);fallback.searchParams.set('manual','1');
  return 'intent://'+target.host+target.pathname+target.search+'#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url='+encodeURIComponent(fallback.href)+';end';
 }
 if(/iphone|ipad|ipod/.test(ua))return target.href.replace(/^https:/,'x-safari-https:');
 return null;
}
export function mayAutoLaunch(inApp,pageURL,previous,now){return inApp&&!new URL(pageURL).searchParams.has('manual')&&now-previous>30000;}
