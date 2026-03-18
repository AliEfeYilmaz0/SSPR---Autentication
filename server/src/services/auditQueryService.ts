import { AuditLog } from "../models/AuditLog";

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const auditQueryService = {
  queryLogs: async (input: {
    page: number;
    limit: number;
    eventType?: string;
    status?: string;
    usernameOrEmail?: string;
    from?: string;
    to?: string;
  }) => {
    const page = Math.max(1, input.page);
    const limit = Math.min(Math.max(1, input.limit), 100);

    const query: Record<string, unknown> = {};

    if (input.eventType) {
      query.eventType = input.eventType;
    }

    if (input.status) {
      query.status = input.status;
    }

    if (input.usernameOrEmail) {
      query.usernameOrEmail = { $regex: input.usernameOrEmail, $options: "i" };
    }

    const fromDate = parseDate(input.from);
    const toDate = parseDate(input.to);

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = fromDate;
      if (toDate) query.createdAt.$lte = toDate;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          id: item._id,
          createdAt: item.createdAt,
          usernameOrEmail: item.usernameOrEmail,
          eventType: item.eventType,
          status: item.status,
          message: item.message,
          metadata: item.metadata ?? {},
        })),
        total,
        page,
        limit,
      },
    } as const;
  },
};
