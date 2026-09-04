import Link from "next/link";
import { DeleteButton } from "./delete-button";

// The View / Edit / Delete button group repeated in every master list
// table's "Actions" cell. `basePath` is the list's route (e.g.
// "/master/category"); `name` is the human label woven into the
// accessible names and the delete confirmation.
export function RowActions({
  basePath,
  id,
  name,
  deleteAction,
  confirmMessage,
}: {
  basePath: string;
  id: string;
  name: string;
  deleteAction: () => Promise<void>;
  confirmMessage: string;
}) {
  return (
    <div className="btn-group btn-group-sm">
      <Link
        href={`${basePath}/${id}/view`}
        className="btn btn-outline-secondary"
        title="View"
        aria-label={`View ${name}`}
      >
        <i className="bi bi-eye" aria-hidden="true"></i>
      </Link>
      <Link
        href={`${basePath}/${id}/edit`}
        className="btn btn-outline-secondary"
        title="Edit"
        aria-label={`Edit ${name}`}
      >
        <i className="bi bi-pencil" aria-hidden="true"></i>
      </Link>
      <DeleteButton action={deleteAction} confirmMessage={confirmMessage} label={`Delete ${name}`} />
    </div>
  );
}
