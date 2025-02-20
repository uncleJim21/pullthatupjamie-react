export const DEBUG_MODE = false;
export const API_URL = DEBUG_MODE ? "http://localhost:4132" : "https://pullthatupjamie-nsh57.ondigitalocean.app";
export const MONTHLY_PRICE_STRING = "$9.99"

export const printLog = (log:string) =>{
  if(DEBUG_MODE){
    console.log(log)
  }
}

export interface AuthConfig {
  type: RequestAuthMethod;
  credentials: {
    username?: string;
    password?: string;
    preimage?: string;
    paymentHash?: string;
  };
}

export enum RequestAuthMethod {
  LIGHTNING = 'lightning',
  SQUARE = 'square',
  FREE = 'free',
  FREE_EXPENDED = 'free-expended'//means they're in limbo and have to choose
}