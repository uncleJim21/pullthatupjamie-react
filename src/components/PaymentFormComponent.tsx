import React, { useEffect, useState } from 'react';
import { BeatLoader } from 'react-spinners';
import "./PaymentFormComponent.css"
var card = null;

function PaymentFormComponent({paymentProcessing, paymentFailed, setPaymentProcessing, setCard}) {

    const [isSquareLoaded, setIsSquareLoaded] = useState(false);

    const isProd = true;
    const appId = isProd ? 'sq0idp-0o-B796NpqAl5ko6qQg8Yg' : 'sandbox-sq0idb-0uB7jvIGEi4AjHYQ1XNF8w'
    const locationId = isProd ? 'L9Q7PS7KTWW35' : 'LZDTC0Z1HFT2V'
    const scriptUrl = isProd ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js'

    useEffect(() => {
        const loadSquareScript = () => {
        return new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = reject;
            document.body.appendChild(script);
        });
        };

        loadSquareScript()
        .then(() => setIsSquareLoaded(true))
        .catch((error) => console.error('Failed to load Square script:', error));

        return () => {
        // Cleanup script if the component is unmounted
        const script = document.querySelector(`script[src="${scriptUrl}"]`);
        if (script) {
            document.body.removeChild(script);
        }
        };
    }, []);

    useEffect(() => {
        const initializePaymentForm = async () => {
          if (!isSquareLoaded || !window.Square) {
            console.error('Square.js is not loaded yet');
            return;
          }
    
          try {
            const payments = window.Square.payments(appId, locationId);
            let newCard = await payments.card();
            await newCard.attach('#card-container');
            setCard(newCard);
            setPaymentProcessing(false);
          } catch (error) {
            console.error('Failed to initialize payment form:', error);
          }
        };
    
        initializePaymentForm();
    }, [isSquareLoaded]);

    return (
      <div className="payment-form-wrapper">
        <div id="payment-form">
          <div 
            id="payment-status-container" 
            style={{ color: paymentFailed ? 'red' : 'black' }} // Changes text color based on isPaymentFailed
          >
            {paymentProcessing ? "Processing..." : paymentFailed ? "Payment Failed" : "Square Ready"}
          </div>
          <div id="card-container"></div>
        </div>
      </div>
    );
}

export default PaymentFormComponent;
