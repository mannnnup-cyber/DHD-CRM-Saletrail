import React from 'react';

const Placeholder: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-amber-500">
        <span className="text-2xl font-bold">!</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-gray-400">This feature is being restored. Check back soon!</p>
      </div>
    </div>
  );
};

export default Placeholder;
