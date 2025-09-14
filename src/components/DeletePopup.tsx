import React from 'react';

type DeleteScenario = 'deleteSingleLine' | 'deleteSingledot' | 'deletAllDots';

interface DeletePopupProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
  scenario: DeleteScenario;
}

const DeletePopup: React.FC<DeletePopupProps> = ({ x, y, onDelete, onClose, scenario }) => {
  const message = scenario === 'deleteSingleLine'
    ? 'Delete Line?'
    : scenario === 'deleteSingledot'
      ? 'Delete dot?'
      : 'Delete all selected dots?';

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      backgroundColor: 'white',
      border: '1px solid black',
      padding: '10px',
      zIndex: 10,
      borderRadius: '5px',
    }}>
      <p>{message}</p>
      <button onClick={onDelete}>Delete</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default DeletePopup;

