import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const brokenLogic = `      let conditions = [];
      if (!includeArchived) {
        conditions.push(eq(schema.leads.isArchived, 0));
      }
      
      if (role === 'Technician') {
        conditions.push(inArray(schema.leads.status, ["Scheduled", "Installed"]));
      } else if (role !== 'Admin') {
        conditions.push(eq(schema.leads.assignedUserId, id));
      }
      
      if (conditions.length > 0) {
        query.where(and(...conditions));
      }
      
      if (role === 'Technician') {
        leads = await query.orderBy(asc(schema.leads.installationSchedule));
      } else {
        leads = await query.orderBy(desc(schema.leads.id));
      }`;

const fixedLogic = `      let conditions = [];
      if (!includeArchived) {
        conditions.push(eq(schema.leads.isArchived, 0));
      }
      
      if (role === 'Technician') {
        conditions.push(inArray(schema.leads.status, ["Scheduled", "Installed"]));
      } else if (role !== 'Admin') {
        conditions.push(eq(schema.leads.assignedUserId, id));
      }
      
      let finalQuery = query;
      if (conditions.length > 0) {
        finalQuery = query.where(and(...conditions));
      }
      
      if (role === 'Technician') {
        leads = await finalQuery.orderBy(asc(schema.leads.installationSchedule));
      } else {
        leads = await finalQuery.orderBy(desc(schema.leads.id));
      }`;

serverCode = serverCode.replace(brokenLogic, fixedLogic);
fs.writeFileSync('server.ts', serverCode);
