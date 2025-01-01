export const API_URL = "https://agent-jamie-dev-test-nw8gj.ondigitalocean.app";
export const DEBUG_MODE = false;
export const MONTHLY_PRICE_STRING = "$9.99"

export const printLog = (log:string) =>{
  if(DEBUG_MODE){
    console.log(log)
  }
}