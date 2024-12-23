import React from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import './PricingCard.css'; // You'll need to create this CSS file

const PricingCard = ({ plan, price, description, features }) => {
    return (
      <div className="bg-[#25262b] rounded-lg p-8 w-[300px] text-center transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,1.0)]">
        <h2 className="text-2xl mb-2 text-white">{plan}</h2>
        <p className="text-gray-400 mb-4">{description}</p>
        <div className="text-4xl font-bold mb-4 text-white">
          <span className="text-base align-super">$</span>
          <span>{price}</span>
          <span className="text-base align-super">/mo</span>
        </div>
        <ul className="list-none p-0 mt-8 text-left">
          {features.map((feature, index) => (
            <li key={index} className="mb-2 text-white">
              <span className="text-white mr-2">✓</span> {feature}
            </li>
          ))}
        </ul>
        <div className="bg-white rounded-lg">
            <br></br>
        </div>
      </div>
    );
  };

// Define PropTypes to specify expected props and types
PricingCard.propTypes = {
  plan: PropTypes.string.isRequired,         // The name of the plan
  price: PropTypes.oneOfType([               // The price (number or string)
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  description: PropTypes.string.isRequired,  // A description of the plan
  features: PropTypes.arrayOf(               // An array of features (strings)
    PropTypes.string
  ).isRequired,
  buttonText: PropTypes.string,              // Optional button text
  isHighlighted: PropTypes.bool,             // Highlight the card (optional)
};

// Define default props for optional fields
PricingCard.defaultProps = {
  buttonText: 'Subscribe', // Default button text
  isHighlighted: false,    // Default to not highlighted
};

export default PricingCard;
