import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, userStatus, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // If the user's role is not in the allowed roles, redirect them to a default page
    return <Navigate to="/" replace />;
  }

  if (userRole === 'policymaker' && userStatus === 'pending') {
    // We might want to let them see a specific pending screen
    // We can handle that in the main layout or here
    // For now, let's allow them through, but the dashboard itself will restrict their view
  }

  return children;
};

export default ProtectedRoute;
