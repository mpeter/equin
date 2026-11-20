-- singularity:snapshot id=eef8ec7e-8847-4ded-ae70-c500d4b03e35 parents=5e5de393-5537-46c3-ad6a-ac76c52ba1f4
-- singularity:supersedes 6bd26dcb
-- singularity:phase expand
CREATE TABLE "report_fix_unknown_claims" (
	"report_id" text NOT NULL,
	"commit" text NOT NULL,
	"filed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_fix_unknown_claims_report_id_commit_pk" PRIMARY KEY("report_id","commit")
);
-- singularity:phase contract
-- singularity:claims
