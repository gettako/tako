import test from 'node:test';
import assert from 'node:assert/strict';

test('Project Validator - validates project name and slug syntax', () => {
  const validateSlug = (val) => {
    if (!val || !val.trim()) return false;
    if (val.length < 2) return false;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val);
  };

  const generateSlugFromName = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Valid slugs
  assert.equal(validateSlug('billing-api'), true);
  assert.equal(validateSlug('prod-db-1'), true);
  assert.equal(validateSlug('my-project'), true);

  // Invalid slugs
  assert.equal(validateSlug(''), false);
  assert.equal(validateSlug('a'), false);
  assert.equal(validateSlug('Billing-Api'), false);
  assert.equal(validateSlug('billing_api'), false);
  assert.equal(validateSlug('-billing-'), false);

  // Slug generation from project names
  assert.equal(generateSlugFromName('Billing Service'), 'billing-service');
  assert.equal(generateSlugFromName('E-Commerce Frontend 2.0'), 'e-commerce-frontend-20');
});

test('Project Lifecycle - updates and renames project metadata', () => {
  let projects = [
    {
      id: 'proj-001',
      name: 'Old Project Name',
      slug: 'old-project-name',
      description: 'Old description',
      environment: 'development',
      status: 'healthy',
      servicesCount: 2,
      healthyServicesCount: 2,
      tags: ['dev'],
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  const updateProject = (id, input) => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Project ${id} not found`);

    projects[idx] = {
      ...projects[idx],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    return projects[idx];
  };

  // Perform project rename / update
  const updated = updateProject('proj-001', {
    name: 'Production Billing System',
    slug: 'production-billing-system',
    description: 'Mission critical billing gateway',
    environment: 'production',
    tags: ['billing', 'fintech', 'prod'],
  });

  assert.equal(updated.name, 'Production Billing System');
  assert.equal(updated.slug, 'production-billing-system');
  assert.equal(updated.description, 'Mission critical billing gateway');
  assert.equal(updated.environment, 'production');
  assert.deepEqual(updated.tags, ['billing', 'fintech', 'prod']);

  // Check state in list
  assert.equal(projects[0].name, 'Production Billing System');
  assert.equal(projects[0].slug, 'production-billing-system');

  // Throws on nonexistent project
  assert.throws(() => updateProject('proj-999', { name: 'Fail' }), /not found/);
});
