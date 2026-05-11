import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle, XCircle, Shield, AlertTriangle } from 'lucide-react';

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // id of user being acted upon

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'policymaker'),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      setPendingUsers(users);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleApprove = async (userId) => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved'
      });
      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error approving user:", error);
    }
    setActionLoading(null);
  };

  const handleReject = async (userId) => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'rejected'
      });
      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error rejecting user:", error);
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-1">
          <Shield className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Admin — Policy Maker Approvals</h2>
          {pendingUsers.length > 0 && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              {pendingUsers.length} Pending
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">Review and approve or reject users who applied for Policy Maker access.</p>
      </div>

      {/* Content card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="text-gray-400 animate-pulse">Loading pending requests…</div>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">All Caught Up</h3>
              <p className="text-gray-400 mt-1 text-sm">There are no pending policy maker applications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map(user => (
                <div key={user.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div>
                    <div className="font-semibold text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                      Applied for Policy Maker Access
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReject(user.id)}
                      disabled={actionLoading === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={actionLoading === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
