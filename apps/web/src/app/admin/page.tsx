export default function AdminPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-500">
        This is a placeholder for the admin interface. Future features:
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
        <li>Manage sources (add / edit / disable RSS &amp; HTML sources)</li>
        <li>Review draft content before publishing</li>
        <li>View publish queue status</li>
        <li>Monitor metrics and analytics</li>
        <li>Manual trigger for /tick pipeline</li>
      </ul>
    </section>
  );
}
