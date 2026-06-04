-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  role text CHECK (role = ANY (ARRAY['admin'::text, 'client'::text, 'contractor'::text])),
  email text,
  name text,
  is_temporary_password boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT proposals_pkey PRIMARY KEY (id),
  CONSTRAINT proposals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proposal_id uuid,
  client_id uuid,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL,
  CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.contractor_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  project_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contractor_projects_pkey PRIMARY KEY (id),
  CONSTRAINT contractor_projects_contractor_id_project_id_key UNIQUE (contractor_id, project_id),
  CONSTRAINT contractor_projects_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT contractor_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

CREATE TABLE public.proposal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  project_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT proposal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT proposal_requests_contractor_id_project_id_key UNIQUE (contractor_id, project_id),
  CONSTRAINT proposal_requests_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT proposal_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);
