import React from 'react';
import FriendForm from './FriendForm';

export default function FriendFormPopup(props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col">
        <FriendForm {...props} />
      </div>
    </div>
  );
}
