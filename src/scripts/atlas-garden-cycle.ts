const smooth=(a:number,b:number,t:number)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
/** Shared visual timing for the rain-fed eighteen-second crop cycle. */
export function gardenCycle(time:number) {
  const t=((time%18)+18)%18;
  return {
    time:t,
    rain:smooth(1.2,2.2,t)*(1-smooth(4.5,5.5,t)),
    sun:smooth(5.2,6.4,t)*(1-smooth(12.0,13.2,t)),
    harvest:smooth(12.6,13.5,t)*(1-smooth(15.4,16.2,t)),
    wet:smooth(1.2,3,t)*(1-smooth(6.0,10,t)),
    sow:smooth(16.1,16.8,t)*(1-smooth(17.6,18,t)),
    phase:t<1.2?'sow':t<5.5?'rain':t<12.6?'grow':t<16.2?'harvest':'sow',
  };
}
