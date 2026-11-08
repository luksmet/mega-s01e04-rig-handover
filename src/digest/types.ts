// Contract for the morning digest: one row per job of a night, read from runs/<night>.jsonl.

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  /** null when the log says so; views show it as `—`. */
  owner: string | null;
  /** Parsed lines for this job. */
  runs: number;
  /** Lines for this job with status `retry`. */
  retries: number;
  /** Status of the job's latest line. */
  lastStatus: RunStatus;
  /** Latest `error` seen for this job, null if none. */
  lastError: string | null;
  /** ISO 8601 with the log's own offset, never converted to UTC. */
  firstAt: string;
  lastAt: string;
};

/** Parsed lines per status, for the board's ok / retry / fail counts. */
export type StatusCounts = Record<RunStatus, number>;

export type DigestNight = {
  /** YYYY-MM-DD, as in the file name. */
  night: string;
  /** Sorted by job. Empty for an empty file ("nothing ran"). */
  rows: DigestRow[];
  counts: StatusCounts;
  /** Lines that did not parse: counted, never thrown. */
  badLines: number;
};

/** null when runs/<night>.jsonl does not exist (404). */
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
