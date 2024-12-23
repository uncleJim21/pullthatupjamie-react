import React, { useState, useEffect } from 'react';
import { BeatLoader } from 'react-spinners';
import { Stepper, Step, StepLabel, Button, Typography, Box, Paper, Grid, FormControlLabel, Checkbox } from '@mui/material';
import PricingCard from '../modal/PricingCard';
import AddressForm from './AddressForm';
import PaymentFormComponent from './PaymentFormComponent';
import cascdrAmber from '../../../media/images/cascdr/cascdrAmberLogo.png';
import squareLogo from '../../../media/images/misc/squareLogo.png';

const steps = ['Sign In', 'Billing Address', 'Payment Details'];

const CheckoutModal = ({ isOpen, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [card, setCard] = useState(null);

  const handleNext = () => setActiveStep(activeStep + 1);
  const handleBack = () => setActiveStep(activeStep - 1);

  const handlePayment = async () => {
    setIsPaymentProcessing(true);
    setPaymentFailed(false);
    try {
      const result = await card.tokenize();
      if (result.status === 'OK') {
        onSuccess();
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      setPaymentFailed(true);
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 1:
        return <AddressForm setParentFormData={setFormData} parentFormData={formData} />;
      case 2:
        return <PaymentFormComponent setCard={setCard} paymentProcessing={isPaymentProcessing} paymentFailed={paymentFailed} />;
      default:
        return <Typography>Sign in to proceed.</Typography>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <Paper className="p-6 max-w-lg w-full rounded-md bg-black text-white">
        <div className="flex justify-end">
          <button className="text-white" onClick={onClose}>X</button>
        </div>
        <Typography variant="h5" align="center">
          {activeStep === 0 ? 'Subscribe' : 'Checkout'}
        </Typography>
        <Stepper activeStep={activeStep} className="my-4">
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {getStepContent(activeStep)}

        <Box className="flex justify-between mt-4">
          {activeStep > 0 && (
            <Button variant="outlined" onClick={handleBack}>Back</Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext} disabled={!formData.firstName}>Next</Button>
          ) : (
            <Button
              variant="contained"
              onClick={handlePayment}
              disabled={!consent || isPaymentProcessing}
            >
              {isPaymentProcessing ? <BeatLoader color="#FFF" /> : 'Subscribe'}
            </Button>
          )}
        </Box>
        {activeStep === 2 && (
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            label="I consent to saving my payment information."
          />
        )}
      </Paper>
    </div>
  );
};

export default CheckoutModal;
