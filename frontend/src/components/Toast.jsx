import React from 'react';

const Toast = ({ message }) => {
  return (
    <div className="toast show">
      <div className="toast-dot"></div>
      <span id="toast-msg">{message}</span>
    </div>
  );
};

export default Toast;