import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/dal";
import { getHomePathForRole } from "@/app/lib/roles";
import { DashboardCharts } from "./dashboard-charts";

export const metadata: Metadata = {
  title: "Dashboard",
};

const CONTACTS = [
  { name: "Count Dracula", date: "2/28/2023", msg: "How have you been? I was...", img: "user1-128x128.jpg" },
  { name: "Sarah Doe", date: "2/23/2023", msg: "I will be waiting for...", img: "user7-128x128.jpg" },
  { name: "Nadia Jolie", date: "2/20/2023", msg: "I'll call you back at...", img: "user3-128x128.jpg" },
  { name: "Nora S. Vans", date: "2/10/2023", msg: "Where is your new...", img: "user5-128x128.jpg" },
  { name: "John K.", date: "1/27/2023", msg: "Can I take a look at...", img: "user6-128x128.jpg" },
  { name: "Kenneth M.", date: "1/4/2023", msg: "Never mind I found...", img: "user8-128x128.jpg" },
];

const MEMBERS = [
  { name: "Alexander Pierce", date: "Today", img: "user1-128x128.jpg" },
  { name: "Norman", date: "Yesterday", img: "user1-128x128.jpg" },
  { name: "Jane", date: "12 Jan", img: "user7-128x128.jpg" },
  { name: "John", date: "12 Jan", img: "user6-128x128.jpg" },
  { name: "Alexander", date: "13 Jan", img: "user2-160x160.jpg" },
  { name: "Sarah", date: "14 Jan", img: "user5-128x128.jpg" },
  { name: "Nora", date: "15 Jan", img: "user4-128x128.jpg" },
  { name: "Nadia", date: "15 Jan", img: "user3-128x128.jpg" },
];

const ORDERS = [
  { id: "OR9842", item: "Call of Duty IV", status: "Shipped", badge: "success", sparkline: "table-sparkline-1" },
  { id: "OR1848", item: "Samsung Smart TV", status: "Pending", badge: "warning", sparkline: "table-sparkline-2" },
  { id: "OR7429", item: "iPhone 6 Plus", status: "Delivered", badge: "danger", sparkline: "table-sparkline-3" },
  { id: "OR7429", item: "Samsung Smart TV", status: "Processing", badge: "info", sparkline: "table-sparkline-4" },
  { id: "OR1848", item: "Samsung Smart TV", status: "Pending", badge: "warning", sparkline: "table-sparkline-5" },
  { id: "OR7429", item: "iPhone 6 Plus", status: "Delivered", badge: "danger", sparkline: "table-sparkline-6" },
  { id: "OR9842", item: "Call of Duty IV", status: "Shipped", badge: "success", sparkline: "table-sparkline-7" },
];

const PRODUCTS = [
  { name: "Samsung TV", price: "$1800", badge: "warning", desc: 'Samsung 32" 1080p 60Hz LED Smart HDTV.' },
  { name: "Bicycle", price: "$700", badge: "info", desc: "26\" Mongoose Dolomite Men's 7-speed, Navy Blue." },
  {
    name: "Xbox One",
    price: "$350",
    badge: "danger",
    desc: "Xbox One Console Bundle with Halo Master Chief Collection.",
  },
  { name: "PlayStation 4", price: "$399", badge: "success", desc: "PlayStation 4 500GB Console (PS4)" },
];

function CardToolButtons() {
  return (
    <div className="card-tools">
      <button type="button" className="btn btn-tool" data-lte-toggle="card-collapse" aria-label="Collapse card">
        <i data-lte-icon="expand" className="bi bi-plus-lg"></i>
        <i data-lte-icon="collapse" className="bi bi-dash-lg"></i>
      </button>
      <button type="button" className="btn btn-tool" data-lte-toggle="card-remove" aria-label="Remove card">
        <i className="bi bi-x-lg"></i>
      </button>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    redirect(getHomePathForRole(session.user.role));
  }

  return (
    <>
      <DashboardCharts />

      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Dashboard v2</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Dashboard v2
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          {/* Info boxes */}
          <div className="row">
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-primary shadow-sm">
                  <i className="bi bi-gear-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">CPU Traffic</span>
                  <span className="info-box-number">
                    10
                    <small>%</small>
                  </span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-danger shadow-sm">
                  <i className="bi bi-hand-thumbs-up-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Likes</span>
                  <span className="info-box-number">41,410</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-success shadow-sm">
                  <i className="bi bi-cart-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Sales</span>
                  <span className="info-box-number">760</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3">
              <div className="info-box">
                <span className="info-box-icon text-bg-warning shadow-sm">
                  <i className="bi bi-people-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">New Members</span>
                  <span className="info-box-number">2,000</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Recap Report */}
          <div className="row">
            <div className="col-md-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Monthly Recap Report</h5>
                  <CardToolButtons />
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-8">
                      <p className="text-center">
                        <strong>Sales: 1 Jan, 2023 - 30 Jul, 2023</strong>
                      </p>
                      <div id="sales-chart"></div>
                    </div>
                    <div className="col-md-4">
                      <p className="text-center">
                        <strong>Goal Completion</strong>
                      </p>

                      <div className="progress-group">
                        Add Products to Cart
                        <span className="float-end">
                          <b>160</b>/200
                        </span>
                        <div className="progress progress-sm">
                          <div className="progress-bar text-bg-primary" style={{ width: "80%" }}></div>
                        </div>
                      </div>

                      <div className="progress-group">
                        Complete Purchase
                        <span className="float-end">
                          <b>310</b>/400
                        </span>
                        <div className="progress progress-sm">
                          <div className="progress-bar text-bg-danger" style={{ width: "75%" }}></div>
                        </div>
                      </div>

                      <div className="progress-group">
                        <span className="progress-text">Visit Premium Page</span>
                        <span className="float-end">
                          <b>480</b>/800
                        </span>
                        <div className="progress progress-sm">
                          <div className="progress-bar text-bg-success" style={{ width: "60%" }}></div>
                        </div>
                      </div>

                      <div className="progress-group">
                        Send Inquiries
                        <span className="float-end">
                          <b>250</b>/500
                        </span>
                        <div className="progress progress-sm">
                          <div className="progress-bar text-bg-warning" style={{ width: "50%" }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="row">
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <span className="text-success">
                          <i className="bi bi-caret-up-fill"></i> 17%
                        </span>
                        <h5 className="fw-bold mb-0">$35,210.43</h5>
                        <span className="text-uppercase">TOTAL REVENUE</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <span className="text-info">
                          <i className="bi bi-caret-left-fill"></i> 0%
                        </span>
                        <h5 className="fw-bold mb-0">$10,390.90</h5>
                        <span className="text-uppercase">TOTAL COST</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <span className="text-success">
                          <i className="bi bi-caret-up-fill"></i> 20%
                        </span>
                        <h5 className="fw-bold mb-0">$24,813.53</h5>
                        <span className="text-uppercase">TOTAL PROFIT</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <span className="text-danger">
                          <i className="bi bi-caret-down-fill"></i> 18%
                        </span>
                        <h5 className="fw-bold mb-0">1200</h5>
                        <span className="text-uppercase">GOAL COMPLETIONS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-8">
              <div className="row g-4 mb-4">
                {/* Direct Chat */}
                <div className="col-md-6">
                  <div className="card direct-chat direct-chat-warning">
                    <div className="card-header">
                      <h3 className="card-title">Direct Chat</h3>
                      <div className="card-tools">
                        <span title="3 New Messages" className="badge text-bg-warning">
                          3
                        </span>
                        <button
                          type="button"
                          className="btn btn-tool"
                          data-lte-toggle="card-collapse"
                          aria-label="Collapse card"
                        >
                          <i data-lte-icon="expand" className="bi bi-plus-lg"></i>
                          <i data-lte-icon="collapse" className="bi bi-dash-lg"></i>
                        </button>
                        <button type="button" className="btn btn-tool" title="Contacts" data-lte-toggle="chat-pane">
                          <i className="bi bi-chat-text-fill"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-tool"
                          data-lte-toggle="card-remove"
                          aria-label="Remove card"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="direct-chat-messages" role="log" tabIndex={0} aria-label="Chat messages">
                        <div className="direct-chat-msg">
                          <div className="direct-chat-infos clearfix">
                            <span className="direct-chat-name float-start">Alexander Pierce</span>
                            <span className="direct-chat-timestamp float-end">23 Jan 2:00 pm</span>
                          </div>
                          <Image
                            className="direct-chat-img"
                            src="/adminlte/assets/img/user1-128x128.jpg"
                            alt="message user"
                            width={40}
                            height={40}
                          />
                          <div className="direct-chat-text">
                            Is this template really for free? That&apos;s unbelievable!
                          </div>
                        </div>

                        <div className="direct-chat-msg end">
                          <div className="direct-chat-infos clearfix">
                            <span className="direct-chat-name float-end">Sarah Bullock</span>
                            <span className="direct-chat-timestamp float-start">23 Jan 2:05 pm</span>
                          </div>
                          <Image
                            className="direct-chat-img"
                            src="/adminlte/assets/img/user3-128x128.jpg"
                            alt="message user"
                            width={40}
                            height={40}
                          />
                          <div className="direct-chat-text">You better believe it!</div>
                        </div>

                        <div className="direct-chat-msg">
                          <div className="direct-chat-infos clearfix">
                            <span className="direct-chat-name float-start">Alexander Pierce</span>
                            <span className="direct-chat-timestamp float-end">23 Jan 5:37 pm</span>
                          </div>
                          <Image
                            className="direct-chat-img"
                            src="/adminlte/assets/img/user1-128x128.jpg"
                            alt="message user"
                            width={40}
                            height={40}
                          />
                          <div className="direct-chat-text">
                            Working with AdminLTE on a great new app! Wanna join?
                          </div>
                        </div>

                        <div className="direct-chat-msg end">
                          <div className="direct-chat-infos clearfix">
                            <span className="direct-chat-name float-end">Sarah Bullock</span>
                            <span className="direct-chat-timestamp float-start">23 Jan 6:10 pm</span>
                          </div>
                          <Image
                            className="direct-chat-img"
                            src="/adminlte/assets/img/user3-128x128.jpg"
                            alt="message user"
                            width={40}
                            height={40}
                          />
                          <div className="direct-chat-text">I would love to.</div>
                        </div>
                      </div>

                      <div className="direct-chat-contacts">
                        <ul className="contacts-list">
                          {CONTACTS.map((c) => (
                            <li key={c.name}>
                              <a href="#">
                                <Image
                                  className="contacts-list-img"
                                  src={`/adminlte/assets/img/${c.img}`}
                                  alt="User Avatar"
                                  width={40}
                                  height={40}
                                />
                                <div className="contacts-list-info">
                                  <span className="contacts-list-name">
                                    {c.name}
                                    <small className="contacts-list-date float-end">{c.date}</small>
                                  </span>
                                  <span className="contacts-list-msg">{c.msg}</span>
                                </div>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="card-footer">
                      <form>
                        <div className="input-group">
                          <input type="text" name="message" placeholder="Type Message ..." className="form-control" />
                          <span className="input-group-append">
                            <button type="button" className="btn btn-warning">
                              Send
                            </button>
                          </span>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Latest Members */}
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Latest Members</h3>
                      <div className="card-tools">
                        <span className="badge text-bg-danger">8 New Members</span>
                        <button
                          type="button"
                          className="btn btn-tool"
                          data-lte-toggle="card-collapse"
                          aria-label="Collapse card"
                        >
                          <i data-lte-icon="expand" className="bi bi-plus-lg"></i>
                          <i data-lte-icon="collapse" className="bi bi-dash-lg"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-tool"
                          data-lte-toggle="card-remove"
                          aria-label="Remove card"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                    <div className="card-body p-0">
                      <div className="row text-center m-1">
                        {MEMBERS.map((m, i) => (
                          <div className="col-3 p-2" key={i}>
                            <Image
                              className="img-fluid rounded-circle"
                              src={`/adminlte/assets/img/${m.img}`}
                              alt="User Image"
                              width={64}
                              height={64}
                            />
                            <a className="btn fw-bold fs-7 text-secondary text-truncate w-100 p-0" href="#">
                              {m.name}
                            </a>
                            <div className="fs-8">{m.date}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card-footer text-center">
                      <a className="link-primary link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover" href="#">
                        View All Users
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest Orders */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Latest Orders</h3>
                  <CardToolButtons />
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table m-0">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Item</th>
                          <th>Status</th>
                          <th>Popularity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ORDERS.map((o, i) => (
                          <tr key={i}>
                            <td>
                              <a
                                href="#"
                                className="link-primary link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover"
                              >
                                {o.id}
                              </a>
                            </td>
                            <td>{o.item}</td>
                            <td>
                              <span className={`badge text-bg-${o.badge}`}>{o.status}</span>
                            </td>
                            <td>
                              <div id={o.sparkline}></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer clearfix">
                  <a href="#" className="btn btn-sm btn-primary float-start">
                    Place New Order
                  </a>
                  <a href="#" className="btn btn-sm btn-secondary float-end">
                    View All Orders
                  </a>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="info-box mb-3 text-bg-warning">
                <span className="info-box-icon">
                  <i className="bi bi-tag-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Inventory</span>
                  <span className="info-box-number">5,200</span>
                </div>
              </div>
              <div className="info-box mb-3 text-bg-success">
                <span className="info-box-icon">
                  <i className="bi bi-heart-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Mentions</span>
                  <span className="info-box-number">92,050</span>
                </div>
              </div>
              <div className="info-box mb-3 text-bg-danger">
                <span className="info-box-icon">
                  <i className="bi bi-cloud-download"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Downloads</span>
                  <span className="info-box-number">114,381</span>
                </div>
              </div>
              <div className="info-box mb-3 text-bg-info">
                <span className="info-box-icon">
                  <i className="bi bi-chat-fill"></i>
                </span>
                <div className="info-box-content">
                  <span className="info-box-text">Direct Messages</span>
                  <span className="info-box-number">163,921</span>
                </div>
              </div>

              {/* Browser Usage */}
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="card-title">Browser Usage</h3>
                  <CardToolButtons />
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-12">
                      <div id="pie-chart"></div>
                    </div>
                  </div>
                </div>
                <div className="card-footer p-0">
                  <ul className="nav nav-pills flex-column">
                    <li className="nav-item">
                      <a href="#" className="nav-link">
                        United States of America
                        <span className="float-end text-danger">
                          <i className="bi bi-arrow-down fs-7"></i> 12%
                        </span>
                      </a>
                    </li>
                    <li className="nav-item">
                      <a href="#" className="nav-link">
                        India
                        <span className="float-end text-success">
                          <i className="bi bi-arrow-up fs-7"></i> 4%
                        </span>
                      </a>
                    </li>
                    <li className="nav-item">
                      <a href="#" className="nav-link">
                        China
                        <span className="float-end text-info">
                          <i className="bi bi-arrow-left fs-7"></i> 0%
                        </span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Recently Added Products */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Recently Added Products</h3>
                  <CardToolButtons />
                </div>
                <div className="card-body p-0">
                  <div className="px-2">
                    {PRODUCTS.map((p, i) => (
                      <div className="d-flex border-top py-2 px-1" key={i}>
                        <div className="col-2">
                          <Image
                            src="/adminlte/assets/img/default-150x150.png"
                            alt="Product"
                            width={50}
                            height={50}
                            className="img-size-50"
                          />
                        </div>
                        <div className="col-10">
                          <a href="#" className="fw-bold">
                            {p.name}
                            <span className={`badge text-bg-${p.badge} float-end`}>{p.price}</span>
                          </a>
                          <div className="text-truncate">{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-footer text-center">
                  <a href="#" className="text-uppercase">
                    View All Products
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
