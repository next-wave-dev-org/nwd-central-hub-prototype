'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProposal() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    
    const newProposal = {
      id: crypto.randomUUID(),
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      budget: formData.get('budget') as string,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem('proposals') || '[]');
    localStorage.setItem('proposals', JSON.stringify([...existing, newProposal]));

    await new Promise((res) => setTimeout(res, 500));
    
    router.push('/proposals');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Project Idea</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Title</label>
            <input
              name="title"
              type="text"
              required
              suppressHydrationWarning={true}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Enter a descriptive title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              required
              rows={4}
              suppressHydrationWarning={true}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="What is your project about?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Budget ($)</label>
            <input
              name="budget"
              type="number"
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="5000"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Submit Proposal'}
          </button>
        </form>
      </div>
    </div>
  );
}