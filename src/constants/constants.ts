export const DEBUG_MODE = true;
export const API_URL = DEBUG_MODE ? "http://localhost:3131" : "https://agent-jamie-dev-test-nw8gj.ondigitalocean.app";
export const MONTHLY_PRICE_STRING = "$9.99"

export const printLog = (log:string) =>{
  if(DEBUG_MODE){
    console.log(log)
  }
}