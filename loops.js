// Plays muted loops only while on screen; honours prefers-reduced-motion (loops stay paused on their poster).
(function(){
  var vids=[].slice.call(document.querySelectorAll('video[data-loop]'));
  var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
  function stopAll(){vids.forEach(function(v){v.pause();v.removeAttribute('autoplay');v.controls=true;});}
  if(mq.matches){stopAll();return;}
  if(!('IntersectionObserver' in window)){vids.forEach(function(v){v.play().catch(function(){});});return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(mq.matches)return;
    if(e.isIntersecting){e.target.play().catch(function(){});}else{e.target.pause();}
  });},{rootMargin:'200px 0px'});
  vids.forEach(function(v){io.observe(v);});
  if(mq.addEventListener)mq.addEventListener('change',function(m){if(m.matches){io.disconnect();stopAll();}});
})();
