import React from 'react';

const Modal = ({ content, onClose }) => {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
};

export default Modal;