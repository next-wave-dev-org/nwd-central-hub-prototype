export const PROPOSAL_STATUSES = {
  Draft: "draft",
  Submitted: "submitted",
  Approved: "approved",
  Rejected: "rejected",
} as const;

export type ProposalStatus =
  (typeof PROPOSAL_STATUSES)[keyof typeof PROPOSAL_STATUSES];

export type Proposal = {
  id: string;
  title: string;
  description?: string;
  budget?: string;
  status: ProposalStatus;
  createdAt?: string;
};

export function canAdminReviewProposal(proposal: Proposal) {
  return proposal.status === PROPOSAL_STATUSES.Submitted;
}

export function canContractorViewProposal(proposal: Proposal) {
  return proposal.status === PROPOSAL_STATUSES.Approved;
}

export function isFinalProposalStatus(status: ProposalStatus) {
  return (
    status === PROPOSAL_STATUSES.Approved ||
    status === PROPOSAL_STATUSES.Rejected
  );
}

export function getProposalStatusLabel(status: ProposalStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getProposalStatusClass(status: ProposalStatus) {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "submitted":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
  }
}
